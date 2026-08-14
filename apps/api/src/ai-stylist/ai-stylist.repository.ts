import { Inject, Injectable } from '@nestjs/common';
import {
  AiProviderCode,
  getPrismaClient,
  Prisma,
  type AiGenerationStatus,
  type PrismaClient,
} from '@thriftage/db';
import {
  aiStylistAssistantPayloadSchema,
  stylistIntentSchema,
  type AiStylistAssistantPayload,
  type AiStylistConversationDetail,
  type AiStylistConversationSummary,
  type AiStylistMessage,
  type StylistIntent,
} from '@thriftage/shared';

import { decodeCursor, encodeCursor } from '../common/cursor';
import { z } from 'zod';
import { AiStylistDomainError } from './ai-stylist.errors';
import type { AiProviderUsage } from './ai-stylist.types';
import type { StylistContextSnapshot } from './stylist-intent';

const conversationCursorSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.literal('AI_STYLIST_CONVERSATION'),
  updatedAt: z.string().datetime({ offset: true }),
});

const savedOutfitCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.literal('SAVED_OUTFIT'),
});

type ConversationWithPreview = Prisma.AiStylistConversationGetPayload<{
  include: { messages: { orderBy: { createdAt: 'desc' }; take: 1 } };
}>;
type ConversationWithMessages = Prisma.AiStylistConversationGetPayload<{
  include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]; take: 100 } };
}>;
type SavedOutfitWithItems = Prisma.SavedOutfitGetPayload<{
  include: { items: { orderBy: { position: 'asc' } } };
}>;

export interface StartedGeneration {
  readonly conversationId: string;
  readonly existingStatus: AiGenerationStatus | null;
  readonly generationId: string;
  readonly idempotentResult: {
    readonly conversation: AiStylistConversationSummary;
    readonly message: AiStylistMessage;
    readonly status: AiGenerationStatus;
  } | null;
  readonly wasExisting: boolean;
}

export interface CompleteGenerationInput {
  readonly assistantContent: string;
  readonly assistantPayload: AiStylistAssistantPayload;
  readonly contextSnapshot: StylistContextSnapshot;
  readonly estimatedCostMicroUsd: number;
  readonly failureCode: string | null;
  readonly latencyMs: number;
  readonly returnedModel: string | null;
  readonly status: 'SUCCEEDED' | 'FALLBACK' | 'REFUSED';
  readonly toolCallCount: number;
  readonly usage: AiProviderUsage;
}

@Injectable()
export class AiStylistRepository {
  public constructor(@Inject('AI_STYLIST_PRISMA') private readonly injectedPrisma?: PrismaClient) {}

  private get prisma(): PrismaClient {
    return this.injectedPrisma ?? getPrismaClient();
  }

  public async createConversation(
    userId: string,
    title = 'New outfit',
  ): Promise<AiStylistConversationSummary> {
    const row = await this.prisma.aiStylistConversation.create({
      data: { title, userId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return this.conversationSummary(row);
  }

  public async listConversations(
    userId: string,
    includeArchived: boolean,
    limit: number,
    rawCursor?: string,
  ): Promise<{ items: AiStylistConversationSummary[]; nextCursor: string | null }> {
    const cursor = decodeCursor(rawCursor, conversationCursorSchema);
    const rows = await this.prisma.aiStylistConversation.findMany({
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(cursor === null
          ? {}
          : {
              OR: [
                { updatedAt: { lt: new Date(cursor.updatedAt) } },
                { id: { lt: cursor.id }, updatedAt: new Date(cursor.updatedAt) },
              ],
            }),
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.conversationSummary(row)),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({
              id: last.id,
              kind: 'AI_STYLIST_CONVERSATION',
              updatedAt: last.updatedAt.toISOString(),
            })
          : null,
    };
  }

  public async conversation(userId: string, id: string): Promise<AiStylistConversationDetail> {
    const row = await this.requireConversation(userId, id, true);
    return {
      ...this.conversationSummary(row),
      messages: row.messages.map((message) => this.message(message)),
    };
  }

  public async rawConversation(
    userId: string,
    id: string,
  ): Promise<{ context: StylistContextSnapshot; title: string }> {
    const row = await this.requireConversation(userId, id, false);
    return {
      context: this.contextSnapshot(row.contextSnapshot),
      title: row.title,
    };
  }

  public async setArchived(
    userId: string,
    id: string,
    archived: boolean,
  ): Promise<AiStylistConversationSummary> {
    await this.requireConversation(userId, id, false);
    const row = await this.prisma.aiStylistConversation.update({
      data: { archivedAt: archived ? new Date() : null },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      where: { id },
    });
    return this.conversationSummary(row);
  }

  public async deleteConversation(userId: string, id: string): Promise<{ deleted: true }> {
    await this.requireConversation(userId, id, false);
    await this.prisma.aiStylistConversation.delete({ where: { id } });
    return { deleted: true };
  }

  public async usageSnapshot(userId: string, conversationId: string, now: Date) {
    const minuteStart = new Date(now.getTime() - 60_000);
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const [perMinute, perDay, sessionTurns, userActive, globalActive, dailyCost] =
      await this.prisma.$transaction([
        this.prisma.aiGeneration.count({ where: { startedAt: { gte: minuteStart }, userId } }),
        this.prisma.aiGeneration.count({ where: { startedAt: { gte: dayStart }, userId } }),
        this.prisma.aiGeneration.count({ where: { conversationId, userId } }),
        this.prisma.aiGeneration.count({ where: { status: 'PROCESSING', userId } }),
        this.prisma.aiGeneration.count({ where: { status: 'PROCESSING' } }),
        this.prisma.aiGeneration.aggregate({
          _sum: { estimatedCostMicroUsd: true },
          where: { startedAt: { gte: dayStart } },
        }),
      ]);
    return {
      dailyCostMicroUsd: dailyCost._sum.estimatedCostMicroUsd ?? 0,
      globalActive,
      perDay,
      perMinute,
      sessionTurns,
      userActive,
    };
  }

  public async startGeneration(input: {
    body: string;
    clientRequestId: string;
    conversationId: string;
    intent: StylistIntent;
    model: string;
    promptVersion: string;
    reasoningEffort: string;
    title: string;
    toolSchemaVersion: string;
    userId: string;
  }): Promise<StartedGeneration> {
    const existing = await this.prisma.aiGeneration.findUnique({
      include: {
        conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 100 } } },
      },
      where: {
        userId_clientRequestId: { clientRequestId: input.clientRequestId, userId: input.userId },
      },
    });
    if (existing !== null) {
      const message = existing.conversation.messages.find((candidate) => {
        const parsed = aiStylistAssistantPayloadSchema.safeParse(candidate.assistantPayload);
        return parsed.success && parsed.data.generationId === existing.id;
      });
      return {
        conversationId: existing.conversationId,
        existingStatus: existing.status,
        generationId: existing.id,
        idempotentResult:
          existing.status !== 'PROCESSING' && message?.role === 'ASSISTANT'
            ? {
                conversation: this.conversationSummary({
                  ...existing.conversation,
                  messages: existing.conversation.messages.slice(0, 1),
                }),
                message: this.message(message),
                status: existing.status,
              }
            : null,
        wasExisting: true,
      };
    }
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const generation = await transaction.aiGeneration.create({
          data: {
            clientRequestId: input.clientRequestId,
            conversationId: input.conversationId,
            intentCategory: input.intent.occasion ?? input.intent.refinement,
            promptVersion: input.promptVersion,
            provider: AiProviderCode.OPENAI,
            reasoningEffort: input.reasoningEffort,
            requestedModel: input.model,
            toolSchemaVersion: input.toolSchemaVersion,
            userId: input.userId,
          },
        });
        await transaction.aiStylistMessage.create({
          data: { content: input.body, conversationId: input.conversationId, role: 'USER' },
        });
        await transaction.aiStylistConversation.update({
          data: {
            archivedAt: null,
            contextSnapshot: this.json(input.intent),
            title: input.title,
          },
          where: { id: input.conversationId },
        });
        return generation;
      });
      return {
        conversationId: input.conversationId,
        existingStatus: null,
        generationId: created.id,
        idempotentResult: null,
        wasExisting: false,
      };
    } catch (error: unknown) {
      if (this.isUniqueViolation(error))
        throw new AiStylistDomainError('AI_GENERATION_IN_PROGRESS');
      throw error;
    }
  }

  public async completeGeneration(
    generationId: string,
    conversationId: string,
    input: CompleteGenerationInput,
  ): Promise<AiStylistMessage> {
    const message = await this.prisma.$transaction(async (transaction) => {
      await transaction.aiGeneration.update({
        data: {
          cachedInputTokens: input.usage.cachedInputTokens,
          completedAt: new Date(),
          estimatedCostMicroUsd: input.estimatedCostMicroUsd,
          failureCode: input.failureCode,
          inputTokens: input.usage.inputTokens,
          latencyMs: input.latencyMs,
          outputTokens: input.usage.outputTokens,
          responsePayload: this.json(input.assistantPayload),
          returnedModel: input.returnedModel,
          status: input.status,
          toolCallCount: input.toolCallCount,
        },
        where: { id: generationId },
      });
      const created = await transaction.aiStylistMessage.create({
        data: {
          assistantPayload: this.json(input.assistantPayload),
          content: input.assistantContent,
          conversationId,
          role: 'ASSISTANT',
        },
      });
      await transaction.aiStylistConversation.update({
        data: { contextSnapshot: this.json(input.contextSnapshot) },
        where: { id: conversationId },
      });
      return created;
    });
    return this.message(message);
  }

  public async failGeneration(
    generationId: string,
    failureCode: string,
    latencyMs: number,
  ): Promise<void> {
    await this.prisma.aiGeneration.updateMany({
      data: { completedAt: new Date(), failureCode, latencyMs, status: 'FAILED' },
      where: { id: generationId, status: 'PROCESSING' },
    });
  }

  public async generationPayload(
    userId: string,
    generationId: string,
  ): Promise<AiStylistAssistantPayload> {
    const row = await this.prisma.aiGeneration.findFirst({
      select: { responsePayload: true },
      where: { id: generationId, userId },
    });
    if (row === null || row.responsePayload === null)
      throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    return aiStylistAssistantPayloadSchema.parse(row.responsePayload);
  }

  public async saveOutfit(
    userId: string,
    generationId: string,
    outfitId: string,
    title?: string,
  ): Promise<string> {
    const generation = await this.prisma.aiGeneration.findFirst({
      select: { conversationId: true, responsePayload: true },
      where: { id: generationId, userId },
    });
    if (generation === null || generation.responsePayload === null)
      throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    const payload = aiStylistAssistantPayloadSchema.parse(generation.responsePayload);
    const outfit = payload.outfits.find(({ id }) => id === outfitId);
    if (outfit === undefined) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    const saved = await this.prisma.savedOutfit.upsert({
      create: {
        items: {
          create: outfit.items.map(({ listing, position, role }) => ({
            garmentRole: role,
            listingId: listing.id,
            listingReferenceId: listing.id,
            position,
          })),
        },
        sourceConversationId: generation.conversationId,
        sourceGenerationId: generationId,
        sourceOutfitId: outfit.id,
        title: title ?? outfit.title,
        userId,
      },
      update: { title: title ?? outfit.title },
      where: { userId_sourceOutfitId: { sourceOutfitId: outfit.id, userId } },
    });
    return saved.id;
  }

  public async listSavedOutfits(
    userId: string,
    limit: number,
    rawCursor?: string,
  ): Promise<{ rows: SavedOutfitWithItems[]; nextCursor: string | null }> {
    const cursor = decodeCursor(rawCursor, savedOutfitCursorSchema);
    const rows = await this.prisma.savedOutfit.findMany({
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        userId,
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }),
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      rows: page,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
              kind: 'SAVED_OUTFIT',
            })
          : null,
    };
  }

  public async savedOutfitRow(userId: string, id: string): Promise<SavedOutfitWithItems> {
    const owner = await this.prisma.savedOutfit.findUnique({
      select: { userId: true },
      where: { id },
    });
    if (owner === null) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    if (owner.userId !== userId) throw new AiStylistDomainError('AI_CONVERSATION_FORBIDDEN');
    const row = await this.prisma.savedOutfit.findUnique({
      include: { items: { orderBy: { position: 'asc' } } },
      where: { id },
    });
    if (row === null) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    return row;
  }

  public async deleteSavedOutfit(userId: string, id: string): Promise<{ deleted: true }> {
    await this.savedOutfitRow(userId, id);
    await this.prisma.savedOutfit.delete({ where: { id } });
    return { deleted: true };
  }

  public async replaceSavedItem(
    userId: string,
    savedOutfitId: string,
    itemId: string,
    replacementListingId: string,
    replacementRequestId: string,
  ): Promise<boolean> {
    await this.savedOutfitRow(userId, savedOutfitId);
    const existing = await this.prisma.savedOutfitItem.findFirst({
      select: { id: true },
      where: { id: itemId, replacementRequestId, savedOutfitId },
    });
    if (existing !== null) return false;
    const result = await this.prisma.savedOutfitItem.updateMany({
      data: {
        listingId: replacementListingId,
        listingReferenceId: replacementListingId,
        replacementRequestId,
      },
      where: { id: itemId, savedOutfitId },
    });
    if (result.count !== 1) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    await this.prisma.savedOutfit.update({ data: {}, where: { id: savedOutfitId } });
    return true;
  }

  public async recordAttribution(input: {
    event: 'OPEN' | 'SAVE' | 'CHECKOUT' | 'PURCHASE';
    generationId: string;
    listingId: string;
    orderId?: string;
    userId: string;
  }): Promise<{ recorded: boolean }> {
    const payload = await this.generationPayload(input.userId, input.generationId);
    if (
      !payload.outfits.some(({ items }) =>
        items.some(({ listing }) => listing.id === input.listingId),
      )
    )
      throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    if (input.event === 'PURCHASE' || input.event === 'CHECKOUT') {
      if (input.orderId === undefined) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
      const order = await this.prisma.order.findFirst({
        select: { id: true },
        where: { buyerId: input.userId, id: input.orderId, listingId: input.listingId },
      });
      if (order === null) throw new AiStylistDomainError('AI_OUTFIT_NOT_FOUND');
    }
    const created = await this.prisma.aiAttributionEvent.createMany({
      data: [
        {
          generationId: input.generationId,
          listingId: input.listingId,
          ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
          type: input.event,
          userId: input.userId,
        },
      ],
      skipDuplicates: true,
    });
    return { recorded: created.count === 1 };
  }

  public async adminMetrics(since: Date) {
    const [
      aggregate,
      activeUsers,
      byModel,
      byStatus,
      attribution,
      savedGenerations,
      openedGenerations,
      savedOutfits,
      providerErrors,
    ] = await this.prisma.$transaction([
      this.prisma.aiGeneration.aggregate({
        _avg: { latencyMs: true },
        _count: { id: true },
        _sum: {
          cachedInputTokens: true,
          estimatedCostMicroUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        where: { startedAt: { gte: since } },
      }),
      this.prisma.aiGeneration.groupBy({ by: ['userId'], where: { startedAt: { gte: since } } }),
      this.prisma.aiGeneration.groupBy({
        _count: { id: true },
        by: ['requestedModel'],
        where: { startedAt: { gte: since } },
      }),
      this.prisma.aiGeneration.groupBy({
        _count: { id: true },
        by: ['status'],
        where: { startedAt: { gte: since } },
      }),
      this.prisma.aiAttributionEvent.groupBy({
        _count: { id: true },
        by: ['type'],
        where: { createdAt: { gte: since } },
      }),
      this.prisma.savedOutfit.groupBy({
        by: ['sourceGenerationId'],
        where: { createdAt: { gte: since }, sourceGenerationId: { not: null } },
      }),
      this.prisma.aiAttributionEvent.groupBy({
        by: ['generationId'],
        where: { createdAt: { gte: since }, type: 'OPEN' },
      }),
      this.prisma.savedOutfit.count({ where: { createdAt: { gte: since } } }),
      this.prisma.aiGeneration.count({
        where: {
          failureCode: {
            in: [
              'AI_PROVIDER_UNAVAILABLE',
              'AI_PROVIDER_TIMEOUT',
              'AI_RESPONSE_INVALID',
              'AI_TOOL_LIMIT_EXCEEDED',
            ],
          },
          startedAt: { gte: since },
        },
      }),
    ]);
    const latency = await this.prisma.$queryRaw<
      readonly { latencyP50Ms: number | null; latencyP95Ms: number | null }[]
    >(Prisma.sql`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY "latency_ms")::float8 AS "latencyP50Ms",
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "latency_ms")::float8 AS "latencyP95Ms"
      FROM "ai_generations"
      WHERE "started_at" >= ${since} AND "latency_ms" IS NOT NULL
    `);
    return {
      activeUsers: activeUsers.length,
      aggregate,
      attribution,
      byModel,
      byStatus,
      latency: latency[0] ?? { latencyP50Ms: null, latencyP95Ms: null },
      openedGenerations: openedGenerations.length,
      providerErrors,
      savedGenerations: savedGenerations.length,
      savedOutfits,
    };
  }

  private async requireConversation(
    userId: string,
    id: string,
    messages: true,
  ): Promise<ConversationWithMessages>;
  private async requireConversation(
    userId: string,
    id: string,
    messages: false,
  ): Promise<Prisma.AiStylistConversationGetPayload<Record<string, never>>>;
  private async requireConversation(userId: string, id: string, messages: boolean) {
    const owner = await this.prisma.aiStylistConversation.findUnique({
      select: { userId: true },
      where: { id },
    });
    if (owner === null) throw new AiStylistDomainError('AI_CONVERSATION_NOT_FOUND');
    if (owner.userId !== userId) throw new AiStylistDomainError('AI_CONVERSATION_FORBIDDEN');
    const row = await this.prisma.aiStylistConversation.findUnique({
      ...(messages
        ? {
            include: {
              messages: {
                orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
                take: 100,
              },
            },
          }
        : {}),
      where: { id },
    });
    if (row === null) throw new AiStylistDomainError('AI_CONVERSATION_NOT_FOUND');
    return row;
  }

  private conversationSummary(
    row: ConversationWithPreview | ConversationWithMessages,
  ): AiStylistConversationSummary {
    const preview = row.messages.at(-1)?.content ?? null;
    return {
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      preview: preview === null ? null : preview.slice(0, 180),
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private message(row: {
    assistantPayload: Prisma.JsonValue | null;
    content: string;
    createdAt: Date;
    id: string;
    role: 'USER' | 'ASSISTANT';
  }): AiStylistMessage {
    return {
      assistantPayload:
        row.assistantPayload === null
          ? null
          : aiStylistAssistantPayloadSchema.parse(row.assistantPayload),
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      role: row.role,
    };
  }

  private contextSnapshot(value: Prisma.JsonValue): StylistContextSnapshot {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    const intentValue = record.intent ?? value;
    const parsedIntent = stylistIntentSchema.safeParse(intentValue);
    const lastOutfitItems = z
      .array(
        z.strictObject({
          listingId: z.string().uuid(),
          role: z.enum([
            'TOP',
            'BOTTOM',
            'DRESS',
            'OUTERWEAR',
            'SHOES',
            'ACCESSORY',
            'BAG',
            'JEWELRY',
            'OTHER',
          ]),
        }),
      )
      .safeParse(record.lastOutfitItems);
    const total = z.number().int().nonnegative().safeParse(record.lastTotalPriceMinor);
    return {
      ...(parsedIntent.success ? { intent: parsedIntent.data } : {}),
      ...(lastOutfitItems.success ? { lastOutfitItems: lastOutfitItems.data } : {}),
      ...(total.success ? { lastTotalPriceMinor: total.data } : {}),
    };
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

export type { SavedOutfitWithItems };
