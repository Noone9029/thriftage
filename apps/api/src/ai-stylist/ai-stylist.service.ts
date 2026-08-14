import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { loadApiConfig, type ApiConfig } from '@thriftage/config/api';
import type { GarmentRole } from '@thriftage/db';
import {
  aiStylistAttributionInputSchema,
  aiStylistConversationCreateInputSchema,
  aiStylistConversationQuerySchema,
  aiStylistMessageInputSchema,
  aiStylistRuntimeConfigurationSchema,
  replaceSavedOutfitItemInputSchema,
  saveOutfitInputSchema,
  type AiStylistAdminMetrics,
  type AiStylistAssistantPayload,
  type AiStylistAttributionInput,
  type AiStylistConversationCreateInput,
  type AiStylistConversationDetail,
  type AiStylistConversationPage,
  type AiStylistConversationQuery,
  type AiStylistGenerationResult,
  type AiStylistMessageInput,
  type AiStylistOutfit,
  type SavedOutfit,
  type SavedOutfitPage,
  type SaveOutfitInput,
  type StylistIntent,
} from '@thriftage/shared';

import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import {
  AI_STYLIST_EVAL_VERSION,
  AI_STYLIST_PROMPT_VERSION,
  AI_STYLIST_SYSTEM_PROMPT,
  AI_STYLIST_TOOL_SCHEMA_VERSION,
} from './ai-stylist.constants';
import { AiStylistDomainError } from './ai-stylist.errors';
import { AiStylistRepository, type SavedOutfitWithItems } from './ai-stylist.repository';
import {
  AI_STYLIST_PROVIDER,
  type AiProviderResult,
  type AiProviderUsage,
  type AiStylistProvider,
  type ComposedOutfitCandidate,
  type ProviderStylistPlan,
  type StylistPersonalizationContext,
} from './ai-stylist.types';
import { AI_STYLIST_TOOL_DEFINITIONS, AiStylistToolRegistry } from './ai-stylist-tool-registry';
import { composeOutfitCandidates } from './outfit-composer';
import { StylistInventoryService } from './stylist-inventory.service';
import {
  deriveStylistIntent,
  deterministicConversationTitle,
  isStylistRequestSupported,
  isUnsafeStylistRequest,
  type StylistContextSnapshot,
} from './stylist-intent';

interface GenerationPlan {
  readonly failureCode: string | null;
  readonly fallbackUsed: boolean;
  readonly latencyMs: number;
  readonly plan: ProviderStylistPlan;
  readonly returnedModel: string | null;
  readonly status: 'SUCCEEDED' | 'FALLBACK' | 'REFUSED';
  readonly toolCallCount: number;
  readonly usage: AiProviderUsage;
}

@Injectable()
export class AiStylistService {
  public constructor(
    @Inject(AiStylistRepository) private readonly repository: AiStylistRepository,
    @Inject(StylistInventoryService) private readonly inventory: StylistInventoryService,
    @Inject(AiStylistToolRegistry) private readonly tools: AiStylistToolRegistry,
    @Inject(AI_STYLIST_PROVIDER) private readonly provider: AiStylistProvider,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
  ) {}

  public async createConversation(
    userId: string,
    inputValue: unknown,
  ): Promise<AiStylistConversationDetail> {
    const input: AiStylistConversationCreateInput =
      aiStylistConversationCreateInputSchema.parse(inputValue);
    if (input.anchorListingId !== undefined) {
      const eligible = await this.inventory.presentEligible(userId, [input.anchorListingId]);
      if (!eligible.has(input.anchorListingId))
        throw new AiStylistDomainError('AI_INVENTORY_UNAVAILABLE');
    }
    const created = await this.repository.createConversation(
      userId,
      input.anchorListingId === undefined ? 'New outfit' : 'Style this item',
    );
    this.events.publish({ actorId: userId, conversationId: created.id, name: 'ai_stylist_opened' });
    return this.repository.conversation(userId, created.id);
  }

  public listConversations(
    userId: string,
    queryValue: unknown,
  ): Promise<AiStylistConversationPage> {
    const query: AiStylistConversationQuery = aiStylistConversationQuerySchema.parse(queryValue);
    return this.repository.listConversations(
      userId,
      query.includeArchived,
      query.limit,
      query.cursor,
    );
  }

  public async conversation(userId: string, id: string): Promise<AiStylistConversationDetail> {
    const conversation = await this.repository.conversation(userId, id);
    const listingIds = conversation.messages.flatMap(
      ({ assistantPayload }) =>
        assistantPayload?.outfits.flatMap(({ items }) => items.map(({ listing }) => listing.id)) ??
        [],
    );
    if (listingIds.length === 0) return conversation;
    const currentListings = await this.inventory.presentEligible(userId, listingIds);
    return {
      ...conversation,
      messages: conversation.messages.map((message) => {
        if (message.assistantPayload === null) return message;
        return {
          ...message,
          assistantPayload: {
            ...message.assistantPayload,
            outfits: message.assistantPayload.outfits.map((outfit) => {
              const items = outfit.items.map((item) => {
                const current = currentListings.get(item.listing.id);
                return {
                  ...item,
                  available: current !== undefined,
                  listing: current ?? item.listing,
                };
              });
              const allAvailable = items.every(({ available }) => available);
              const currencies = new Set(items.map(({ listing }) => listing.currency));
              return {
                ...outfit,
                currency:
                  allAvailable && currencies.size === 1
                    ? (items[0]?.listing.currency ?? null)
                    : null,
                items,
                totalPriceMinor: allAvailable
                  ? items.reduce((sum, { listing }) => sum + listing.priceMinor, 0)
                  : null,
                unmetConstraints: allAvailable
                  ? outfit.unmetConstraints
                  : [
                      ...new Set([
                        ...outfit.unmetConstraints,
                        'One or more items are no longer available.',
                      ]),
                    ],
              };
            }),
          },
        };
      }),
    };
  }

  public archiveConversation(userId: string, id: string, archived: boolean) {
    return this.repository.setArchived(userId, id, archived);
  }

  public deleteConversation(userId: string, id: string) {
    return this.repository.deleteConversation(userId, id);
  }

  public async generate(
    userId: string,
    conversationId: string,
    inputValue: unknown,
  ): Promise<AiStylistGenerationResult> {
    const input: AiStylistMessageInput = aiStylistMessageInputSchema.parse(inputValue);
    const config = this.config();
    if (!config.aiStylistEnabled) throw new AiStylistDomainError('AI_STYLIST_DISABLED');
    if (input.body.length > config.aiStylistMaxInputCharacters)
      throw new AiStylistDomainError('AI_REQUEST_NOT_SUPPORTED');
    if (isUnsafeStylistRequest(input.body) || !isStylistRequestSupported(input.body))
      throw new AiStylistDomainError('AI_REQUEST_NOT_SUPPORTED');

    const conversation = await this.repository.rawConversation(userId, conversationId);
    const intent = deriveStylistIntent(
      input.body,
      conversation.context,
      input.anchorListingId,
      config.aiStylistMaxOutfitOptions,
    );
    const started = await this.repository.startGeneration({
      body: input.body,
      clientRequestId: input.requestId,
      conversationId,
      intent,
      model: config.aiStylistModel,
      promptVersion: AI_STYLIST_PROMPT_VERSION,
      reasoningEffort: config.aiStylistReasoningEffort,
      title:
        conversation.title === 'New outfit'
          ? deterministicConversationTitle(input.body)
          : conversation.title,
      toolSchemaVersion: AI_STYLIST_TOOL_SCHEMA_VERSION,
      userId,
    });
    if (started.idempotentResult !== null) {
      return {
        conversation: started.idempotentResult.conversation,
        message: started.idempotentResult.message,
        status: started.idempotentResult.status,
      };
    }
    if (started.wasExisting)
      throw new AiStylistDomainError(
        started.existingStatus === 'PROCESSING'
          ? 'AI_GENERATION_IN_PROGRESS'
          : 'AI_PROVIDER_UNAVAILABLE',
      );
    if (started.conversationId !== conversationId)
      throw new AiStylistDomainError('AI_GENERATION_IN_PROGRESS');

    const generationStartedAt = Date.now();
    try {
      this.assertUsageAllowed(
        await this.repository.usageSnapshot(userId, conversationId, new Date()),
        config,
      );
      this.events.publish({
        actorId: userId,
        conversationId,
        generationId: started.generationId,
        name: 'ai_message_sent',
      });
      if (intent.refinement !== 'NONE')
        this.events.publish({
          actorId: userId,
          conversationId,
          generationId: started.generationId,
          name: 'ai_refinement_requested',
        });

      const personalization = await this.inventory.personalizationContext(userId);
      const inventory = await this.inventory.search(userId, intent, personalization);
      const deterministic = composeOutfitCandidates(inventory, intent, {
        maxOptions: config.aiStylistMaxOutfitOptions,
      });
      const session = this.tools.createSession({
        initialCandidates: inventory,
        intent,
        maxOptions: config.aiStylistMaxOutfitOptions,
        maxToolCalls: config.aiStylistMaxToolCalls,
        personalization,
        userId,
      });
      session.addComposed(deterministic);
      const generationPlan = await this.planGeneration(
        userId,
        input.body,
        conversation.context,
        intent,
        deterministic,
        session.execute.bind(session),
        config,
      );
      const allCandidates = new Map(
        [...deterministic, ...session.candidates()].map((candidate) => [candidate.id, candidate]),
      );
      const { finalPlan, outfits, validationFallback } = await this.finalizePlan(
        userId,
        intent,
        generationPlan.plan,
        allCandidates,
        deterministic,
      );
      const fallbackUsed = generationPlan.fallbackUsed || validationFallback;
      const assistantPayload: AiStylistAssistantPayload = {
        fallbackUsed,
        generationId: started.generationId,
        kind: finalPlan.kind,
        outfits,
        promptVersion: AI_STYLIST_PROMPT_VERSION,
        quickRefinements: finalPlan.quickRefinements,
      };
      const contextSnapshot = this.nextContext(intent, outfits);
      const usage = generationPlan.usage;
      const status = fallbackUsed ? 'FALLBACK' : generationPlan.status;
      const message = await this.repository.completeGeneration(
        started.generationId,
        conversationId,
        {
          assistantContent: finalPlan.assistantMessage,
          assistantPayload,
          contextSnapshot,
          estimatedCostMicroUsd: this.estimatedCost(usage, config),
          failureCode:
            generationPlan.failureCode ?? (validationFallback ? 'AI_RESPONSE_INVALID' : null),
          latencyMs: Math.max(generationPlan.latencyMs, Date.now() - generationStartedAt),
          returnedModel: generationPlan.returnedModel,
          status,
          toolCallCount: Math.max(generationPlan.toolCallCount, session.toolCallCount),
          usage,
        },
      );
      this.publishGenerationEvents(
        userId,
        conversationId,
        started.generationId,
        outfits,
        fallbackUsed,
      );
      const completed = await this.repository.conversation(userId, conversationId);
      return {
        conversation: {
          archivedAt: completed.archivedAt,
          createdAt: completed.createdAt,
          id: completed.id,
          preview: completed.preview,
          title: completed.title,
          updatedAt: completed.updatedAt,
        },
        message,
        status,
      };
    } catch (error: unknown) {
      await this.repository
        .failGeneration(
          started.generationId,
          error instanceof AiStylistDomainError ? error.code : 'AI_PROVIDER_UNAVAILABLE',
          Date.now() - generationStartedAt,
        )
        .catch(() => undefined);
      this.events.publish({
        actorId: userId,
        conversationId,
        generationId: started.generationId,
        name: 'ai_response_failed',
      });
      throw error;
    }
  }

  public async saveOutfit(userId: string, inputValue: unknown): Promise<SavedOutfit> {
    const input: SaveOutfitInput = saveOutfitInputSchema.parse(inputValue);
    const id = await this.repository.saveOutfit(
      userId,
      input.generationId,
      input.outfitId,
      input.title,
    );
    this.events.publish({
      actorId: userId,
      generationId: input.generationId,
      name: 'ai_outfit_saved',
      outfitId: input.outfitId,
    });
    return this.savedOutfit(userId, id);
  }

  public async savedOutfits(userId: string, queryValue: unknown): Promise<SavedOutfitPage> {
    const query = aiStylistConversationQuerySchema
      .pick({ cursor: true, limit: true })
      .parse(queryValue);
    const page = await this.repository.listSavedOutfits(userId, query.limit, query.cursor);
    return { items: await this.resolveSavedRows(userId, page.rows), nextCursor: page.nextCursor };
  }

  public async savedOutfit(userId: string, id: string): Promise<SavedOutfit> {
    const row = await this.repository.savedOutfitRow(userId, id);
    const resolved = await this.resolveSavedRows(userId, [row]);
    const first = resolved[0];
    if (first === undefined) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    return first;
  }

  public deleteSavedOutfit(userId: string, id: string) {
    return this.repository.deleteSavedOutfit(userId, id);
  }

  public async replaceSavedOutfitItem(
    userId: string,
    savedOutfitId: string,
    itemId: string,
    inputValue: unknown,
  ): Promise<SavedOutfit> {
    const input = replaceSavedOutfitItemInputSchema.parse(inputValue);
    const row = await this.repository.savedOutfitRow(userId, savedOutfitId);
    const target = row.items.find(({ id }) => id === itemId);
    if (target === undefined) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    if (target.replacementRequestId === input.requestId)
      return this.savedOutfit(userId, savedOutfitId);
    const existingIds = row.items
      .filter(({ id, listingId }) => id !== itemId && listingId !== null)
      .map(({ listingId }) => listingId)
      .filter((id): id is string => id !== null);
    const eligible = await this.inventory.presentEligible(userId, existingIds);
    const lockedListingIds = existingIds.filter((id) => eligible.has(id));
    const personalization = await this.inventory.personalizationContext(userId);
    const intent = this.replacementIntent(target.garmentRole, lockedListingIds, personalization);
    const candidates = await this.inventory.search(userId, intent, personalization);
    const composed = composeOutfitCandidates(candidates, intent, { maxOptions: 3 });
    const replacement = composed
      .flatMap(({ items }) => items)
      .find(
        ({ garmentRole, id }) =>
          garmentRole === target.garmentRole && id !== target.listingReferenceId,
      );
    if (replacement === undefined) throw new AiStylistDomainError('AI_INVENTORY_UNAVAILABLE');
    await this.repository.replaceSavedItem(
      userId,
      savedOutfitId,
      itemId,
      replacement.id,
      input.requestId,
    );
    return this.savedOutfit(userId, savedOutfitId);
  }

  public async recordAttribution(userId: string, inputValue: unknown) {
    const input: AiStylistAttributionInput = aiStylistAttributionInputSchema.parse(inputValue);
    const result = await this.repository.recordAttribution({
      event: input.event,
      generationId: input.generationId,
      listingId: input.listingId,
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
      userId,
    });
    const name =
      input.event === 'OPEN'
        ? 'ai_outfit_item_opened'
        : input.event === 'SAVE'
          ? 'ai_outfit_item_saved'
          : input.event === 'PURCHASE'
            ? 'ai_outfit_item_purchased'
            : 'ai_outfit_item_opened';
    this.events.publish({
      actorId: userId,
      generationId: input.generationId,
      listingId: input.listingId,
      name,
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
    });
    return result;
  }

  public async adminMetrics(): Promise<AiStylistAdminMetrics> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const metrics = await this.repository.adminMetrics(since);
    const total = metrics.aggregate._count.id;
    const statusCounts = new Map(metrics.byStatus.map(({ _count, status }) => [status, _count.id]));
    return {
      activeUsers: metrics.activeUsers,
      attribution: metrics.attribution.map(({ _count, type }) => ({ count: _count.id, key: type })),
      averageLatencyMs: metrics.aggregate._avg.latencyMs,
      cachedInputTokens: metrics.aggregate._sum.cachedInputTokens ?? 0,
      configuration: this.runtimeConfiguration(),
      estimatedCostMicroUsd: metrics.aggregate._sum.estimatedCostMicroUsd ?? 0,
      fallbackRate: total === 0 ? 0 : (statusCounts.get('FALLBACK') ?? 0) / total,
      generations: total,
      generationsByModel: metrics.byModel.map(({ _count, requestedModel }) => ({
        count: _count.id,
        key: requestedModel,
      })),
      generationsByStatus: metrics.byStatus.map(({ _count, status }) => ({
        count: _count.id,
        key: status,
      })),
      inputTokens: metrics.aggregate._sum.inputTokens ?? 0,
      latencyP50Ms: metrics.latency.latencyP50Ms,
      latencyP95Ms: metrics.latency.latencyP95Ms,
      listingClickThroughRate: total === 0 ? 0 : metrics.openedGenerations / total,
      outfitSaveRate: total === 0 ? 0 : metrics.savedGenerations / total,
      outputTokens: metrics.aggregate._sum.outputTokens ?? 0,
      providerErrorRate: total === 0 ? 0 : (statusCounts.get('FAILED') ?? 0) / total,
      savedOutfits: metrics.savedOutfits,
    };
  }

  public runtimeConfiguration() {
    const config = this.config();
    return aiStylistRuntimeConfigurationSchema.parse({
      dailyBudgetMicroUsd: config.aiStylistDailyBudgetMicroUsd ?? null,
      dailyUserLimit: config.aiStylistDailyUserLimit,
      enabled: config.aiStylistEnabled,
      evalVersion: AI_STYLIST_EVAL_VERSION,
      maxConcurrentGenerations: config.aiStylistMaxConcurrentGenerations,
      maxInputCharacters: config.aiStylistMaxInputCharacters,
      maxOutfitOptions: config.aiStylistMaxOutfitOptions,
      maxOutputTokens: config.aiStylistMaxOutputTokens,
      maxRequestsPerMinute: config.aiStylistMaxRequestsPerMinute,
      maxToolCalls: config.aiStylistMaxToolCalls,
      model: config.aiStylistModel,
      promptVersion: AI_STYLIST_PROMPT_VERSION,
      reasoningEffort: config.aiStylistReasoningEffort,
      sessionTurnLimit: config.aiStylistSessionTurnLimit,
      timeoutMs: config.aiStylistTimeoutMs,
      toolSchemaVersion: AI_STYLIST_TOOL_SCHEMA_VERSION,
    });
  }

  private config(): ApiConfig {
    return loadApiConfig(process.env);
  }

  private assertUsageAllowed(
    usage: {
      dailyCostMicroUsd: number;
      globalActive: number;
      perDay: number;
      perMinute: number;
      sessionTurns: number;
      userActive: number;
    },
    config: ApiConfig,
  ): void {
    if (
      usage.perMinute > config.aiStylistMaxRequestsPerMinute ||
      usage.perDay > config.aiStylistDailyUserLimit ||
      usage.sessionTurns > config.aiStylistSessionTurnLimit ||
      usage.globalActive > config.aiStylistMaxConcurrentGenerations
    )
      throw new AiStylistDomainError('AI_RATE_LIMITED');
    if (usage.userActive > 1) throw new AiStylistDomainError('AI_GENERATION_IN_PROGRESS');
    if (
      config.aiStylistDailyBudgetMicroUsd !== undefined &&
      usage.dailyCostMicroUsd >= config.aiStylistDailyBudgetMicroUsd
    )
      throw new AiStylistDomainError('AI_STYLIST_DISABLED');
  }

  private async planGeneration(
    userId: string,
    body: string,
    context: StylistContextSnapshot,
    intent: StylistIntent,
    deterministic: readonly ComposedOutfitCandidate[],
    executeTool: (name: string, input: unknown) => Promise<unknown>,
    config: ApiConfig,
  ): Promise<GenerationPlan> {
    if (deterministic.length === 0) {
      return this.fallbackPlan([], 'AI_INVENTORY_UNAVAILABLE', 0);
    }
    try {
      const result: AiProviderResult = await this.provider.generate(
        {
          conversationSummary: { ...context },
          initialCandidates: deterministic,
          intent,
          maxOutputTokens: config.aiStylistMaxOutputTokens,
          maxToolCalls: config.aiStylistMaxToolCalls,
          model: config.aiStylistModel,
          reasoningEffort: config.aiStylistReasoningEffort,
          safetyIdentifier: createHash('sha256')
            .update(`thriftage:${userId}`)
            .digest('hex')
            .slice(0, 48),
          systemPrompt: AI_STYLIST_SYSTEM_PROMPT,
          timeoutMs: config.aiStylistTimeoutMs,
          tools: AI_STYLIST_TOOL_DEFINITIONS,
          userMessage: body,
        },
        executeTool,
      );
      return {
        failureCode: null,
        fallbackUsed: false,
        latencyMs: result.latencyMs,
        plan: result.plan,
        returnedModel: result.returnedModel,
        status: result.plan.kind === 'REFUSAL' ? 'REFUSED' : 'SUCCEEDED',
        toolCallCount: result.toolCallCount,
        usage: result.usage,
      };
    } catch (error: unknown) {
      const code = error instanceof AiStylistDomainError ? error.code : 'AI_PROVIDER_UNAVAILABLE';
      return this.fallbackPlan(
        deterministic,
        code,
        error instanceof AiStylistDomainError ? (error.operations?.latencyMs ?? 0) : 0,
        error instanceof AiStylistDomainError ? error.operations?.usage : undefined,
        error instanceof AiStylistDomainError ? (error.operations?.toolCallCount ?? 0) : 0,
      );
    }
  }

  private fallbackPlan(
    candidates: readonly ComposedOutfitCandidate[],
    failureCode: string,
    latencyMs: number,
    usage: AiProviderUsage = { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 },
    toolCallCount = 0,
  ): GenerationPlan {
    const selected = candidates.slice(0, 3);
    return {
      failureCode,
      fallbackUsed: true,
      latencyMs,
      plan: {
        assistantMessage:
          selected.length === 0
            ? 'I could not find a complete eligible outfit for those constraints. Try widening your budget, colors, or preferred style.'
            : 'The AI stylist is unavailable right now, so I built these options with Thriftage’s verified Style Intelligence.',
        kind: selected.length === 0 ? 'NO_MATCH' : 'OUTFITS',
        quickRefinements:
          selected.length === 0
            ? []
            : ['CHEAPER', 'MORE_CASUAL', 'DIFFERENT_COLORS', 'ANOTHER_OPTION'],
        selections: selected.map((candidate, index) => ({
          candidateId: candidate.id,
          explanation:
            'This option passed current inventory, budget, role, color, size-confidence, and marketplace eligibility checks.',
          title: `Grounded option ${index + 1}`,
        })),
      },
      returnedModel: null,
      status: 'FALLBACK',
      toolCallCount,
      usage,
    };
  }

  private async finalizePlan(
    userId: string,
    intent: StylistIntent,
    plan: ProviderStylistPlan,
    candidates: ReadonlyMap<string, ComposedOutfitCandidate>,
    deterministic: readonly ComposedOutfitCandidate[],
  ): Promise<{
    finalPlan: ProviderStylistPlan;
    outfits: AiStylistOutfit[];
    validationFallback: boolean;
  }> {
    if (this.unsafeModelCopy(plan.assistantMessage)) {
      const fallback = this.fallbackPlan(deterministic, 'AI_RESPONSE_INVALID', 0);
      return this.finalizePlan(userId, intent, fallback.plan, candidates, deterministic).then(
        (result) => ({ ...result, validationFallback: true }),
      );
    }
    if (plan.kind !== 'OUTFITS')
      return { finalPlan: { ...plan, selections: [] }, outfits: [], validationFallback: false };
    const seen = new Set<string>();
    const requestedSelections = plan.selections.slice(0, intent.optionCount);
    const selections: {
      candidate: ComposedOutfitCandidate;
      selection: ProviderStylistPlan['selections'][number];
    }[] = [];
    for (const selection of requestedSelections) {
      const candidate = candidates.get(selection.candidateId);
      if (
        candidate === undefined ||
        this.unsafeModelCopy(selection.explanation) ||
        seen.has(selection.candidateId)
      )
        continue;
      seen.add(selection.candidateId);
      selections.push({ candidate, selection });
    }
    let validationFallback =
      selections.length !== requestedSelections.length || selections.length === 0;
    let selected = validationFallback
      ? deterministic.slice(0, intent.optionCount).map((candidate, index) => ({
          candidate,
          selection: {
            candidateId: candidate.id,
            explanation: 'This option was recomputed and revalidated by Thriftage.',
            title: `Verified option ${index + 1}`,
          },
        }))
      : selections;
    let outfits = await this.presentSelections(userId, intent, selected);
    if (outfits.length !== selected.length) {
      validationFallback = true;
      selected = deterministic.slice(0, intent.optionCount).map((candidate, index) => ({
        candidate,
        selection: {
          candidateId: candidate.id,
          explanation: 'This option was recomputed after inventory changed.',
          title: `Current option ${index + 1}`,
        },
      }));
      outfits = await this.presentSelections(userId, intent, selected);
    }
    if (outfits.length === 0) {
      return {
        finalPlan: {
          assistantMessage:
            'Those items are no longer available. Try another option and I’ll rebuild from current inventory.',
          kind: 'NO_MATCH',
          quickRefinements: ['ANOTHER_OPTION'],
          selections: [],
        },
        outfits: [],
        validationFallback: true,
      };
    }
    return {
      finalPlan: {
        ...plan,
        selections: selected.map(({ selection }) => selection),
      },
      outfits,
      validationFallback,
    };
  }

  private async presentSelections(
    userId: string,
    intent: StylistIntent,
    selected: readonly {
      readonly candidate: ComposedOutfitCandidate;
      readonly selection: { readonly explanation: string; readonly title: string };
    }[],
  ): Promise<AiStylistOutfit[]> {
    const listingIds = selected.flatMap(({ candidate }) => candidate.items.map(({ id }) => id));
    const listings = await this.inventory.presentEligible(userId, listingIds);
    return selected.flatMap(({ candidate, selection }) => {
      if (candidate.items.some(({ id }) => !listings.has(id))) return [];
      const resolved = candidate.items.map(({ id }) => listings.get(id));
      if (resolved.some((listing) => listing === undefined)) return [];
      const current = resolved.filter(
        (listing): listing is NonNullable<typeof listing> => listing !== undefined,
      );
      const currencies = new Set(current.map(({ currency }) => currency));
      if (currencies.size !== 1 || !currencies.has(intent.currency)) return [];
      const totalPriceMinor = current.reduce((sum, listing) => sum + listing.priceMinor, 0);
      if (intent.budgetMaxMinor !== null && totalPriceMinor > intent.budgetMaxMinor) return [];
      const items = candidate.items.map((item, position) => ({
        available: true,
        listing: listings.get(item.id)!,
        position,
        role: item.garmentRole as GarmentRole,
        uncertainConstraints: [
          ...(item.sizeConfidence === 'UNKNOWN'
            ? ['Size compatibility is unknown; check the listing details.']
            : []),
          ...(intent.modesty === true
            ? ['Coverage metadata is unavailable; review photos and listing details.']
            : []),
        ],
      }));
      return [
        {
          currency: current[0]?.currency ?? null,
          explanation: selection.explanation,
          id: candidate.id,
          items,
          matchScore: candidate.matchScore,
          title: selection.title,
          totalPriceMinor,
          unmetConstraints: [...candidate.uncertainConstraints],
        },
      ];
    });
  }

  private nextContext(
    intent: StylistIntent,
    outfits: readonly AiStylistOutfit[],
  ): StylistContextSnapshot {
    const first = outfits[0];
    return {
      intent,
      ...(first === undefined
        ? {}
        : {
            lastOutfitItems: first.items.map(({ listing, role }) => ({
              listingId: listing.id,
              role,
            })),
            ...(first.totalPriceMinor === null
              ? {}
              : { lastTotalPriceMinor: first.totalPriceMinor }),
          }),
    };
  }

  private estimatedCost(usage: AiProviderUsage, config: ApiConfig): number {
    const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
    const numerator =
      uncached * config.aiStylistInputCostMicroUsdPerMillion +
      usage.cachedInputTokens * config.aiStylistCachedInputCostMicroUsdPerMillion +
      usage.outputTokens * config.aiStylistOutputCostMicroUsdPerMillion;
    return Math.ceil(numerator / 1_000_000);
  }

  private async resolveSavedRows(
    userId: string,
    rows: readonly SavedOutfitWithItems[],
  ): Promise<SavedOutfit[]> {
    const ids = rows.flatMap(({ items }) =>
      items.map(({ listingReferenceId }) => listingReferenceId),
    );
    const listings = await this.inventory.presentEligible(userId, ids);
    return rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      items: row.items.map((item) => ({
        available: listings.has(item.listingReferenceId),
        id: item.id,
        listing: listings.get(item.listingReferenceId) ?? null,
        listingReferenceId: item.listingReferenceId,
        position: item.position,
        role: item.garmentRole,
      })),
      sourceGenerationId: row.sourceGenerationId,
      sourceOutfitId: row.sourceOutfitId,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private replacementIntent(
    role: GarmentRole,
    lockedListingIds: readonly string[],
    personalization: StylistPersonalizationContext,
  ): StylistIntent {
    return {
      anchorListingId: null,
      budgetMaxMinor: personalization.budgetMaxMinor,
      budgetMinMinor: personalization.budgetMinMinor,
      colors: personalization.colors
        .filter(({ sentiment }) => sentiment === 'PREFER')
        .map(({ colorFamily }) => colorFamily as StylistIntent['colors'][number])
        .slice(0, 5),
      currency: personalization.currency,
      excludedColors: personalization.colors
        .filter(({ sentiment }) => sentiment === 'AVOID')
        .map(({ colorFamily }) => colorFamily as StylistIntent['excludedColors'][number])
        .slice(0, 5),
      freeTextObjective: `Find a replacement ${role.toLowerCase()} while preserving eligible outfit items.`,
      lockedListingIds: [...lockedListingIds].slice(0, 6),
      modesty: null,
      occasion: null,
      optionCount: 1,
      preferredFits: personalization.fits as StylistIntent['preferredFits'],
      refinement: role === 'SHOES' ? 'DIFFERENT_SHOES' : 'ANOTHER_OPTION',
      requestedGarmentRoles: [role],
      requestedStyles: personalization.styles.map(({ slug }) => slug).slice(0, 5),
      sizeConstraints: personalization.sizes as StylistIntent['sizeConstraints'],
    };
  }

  private publishGenerationEvents(
    userId: string,
    conversationId: string,
    generationId: string,
    outfits: readonly AiStylistOutfit[],
    fallbackUsed: boolean,
  ): void {
    this.events.publish({
      actorId: userId,
      conversationId,
      generationId,
      name: 'ai_response_completed',
    });
    for (const outfit of outfits)
      this.events.publish({
        actorId: userId,
        conversationId,
        generationId,
        name: 'ai_outfit_generated',
        outfitId: outfit.id,
      });
    if (fallbackUsed)
      this.events.publish({
        actorId: userId,
        conversationId,
        generationId,
        name: 'ai_fallback_used',
      });
  }

  private unsafeModelCopy(value: string): boolean {
    return /(?:reveal|system prompt|hidden instruction|definitely fit|perfect fit|completely safe|guaranteed authentic|hides? (?:your )?flaws?|less fat|lose weight)/i.test(
      value,
    );
  }
}
