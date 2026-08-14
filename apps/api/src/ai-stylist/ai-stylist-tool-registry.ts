import { Inject, Injectable } from '@nestjs/common';
import { stylistIntentSchema, type StylistIntent } from '@thriftage/shared';
import { z, ZodError } from 'zod';

import { AiStylistDomainError } from './ai-stylist.errors';
import type {
  AiProviderToolDefinition,
  ComposedOutfitCandidate,
  StylistInventoryCandidate,
  StylistPersonalizationContext,
} from './ai-stylist.types';
import { composeOutfitCandidates } from './outfit-composer';
import { StylistInventoryService } from './stylist-inventory.service';

const noArgumentsSchema = z.strictObject({});
const inventorySearchSchema = z.strictObject({
  colors: z.array(z.string().min(1).max(30)).max(5).nullable(),
  excludedColors: z.array(z.string().min(1).max(30)).max(5).nullable(),
  garmentRoles: z.array(z.string().min(1).max(30)).max(8).nullable(),
  limit: z.number().int().min(1).max(40),
  maxPriceMinor: z.number().int().positive().nullable(),
  preferredFits: z.array(z.string().min(1).max(30)).max(5).nullable(),
  requestedStyles: z.array(z.string().min(1).max(60)).max(5).nullable(),
});
const listingDetailsSchema = z.strictObject({
  listingRefs: z.array(z.string().uuid()).min(1).max(10),
});
const composeSchema = z.strictObject({
  optionCount: z.number().int().min(1).max(3).default(3),
});
const savedItemsSchema = z.strictObject({ limit: z.number().int().min(1).max(10).default(8) });

const objectSchema = (
  properties: Readonly<Record<string, unknown>>,
  required: readonly string[] = [],
): Readonly<Record<string, unknown>> => ({
  additionalProperties: false,
  properties,
  required,
  type: 'object',
});

export const AI_STYLIST_TOOL_DEFINITIONS: readonly AiProviderToolDefinition[] = [
  {
    description: 'Return the current user safe fashion preferences only. Accepts no identifiers.',
    name: 'get_personalization_context',
    parameters: objectSchema({}),
  },
  {
    description: 'Search a bounded set of currently eligible marketplace inventory.',
    name: 'search_inventory',
    parameters: objectSchema(
      {
        colors: { items: { type: 'string' }, maxItems: 5, type: ['array', 'null'] },
        excludedColors: { items: { type: 'string' }, maxItems: 5, type: ['array', 'null'] },
        garmentRoles: { items: { type: 'string' }, maxItems: 8, type: ['array', 'null'] },
        limit: { maximum: 40, minimum: 1, type: 'integer' },
        maxPriceMinor: { minimum: 1, type: ['integer', 'null'] },
        preferredFits: { items: { type: 'string' }, maxItems: 5, type: ['array', 'null'] },
        requestedStyles: { items: { type: 'string' }, maxItems: 5, type: ['array', 'null'] },
      },
      [
        'colors',
        'excludedColors',
        'garmentRoles',
        'limit',
        'maxPriceMinor',
        'preferredFits',
        'requestedStyles',
      ],
    ),
  },
  {
    description:
      'Return safe structured facts for bounded inventory references already authorized in this session.',
    name: 'get_listing_details',
    parameters: objectSchema(
      {
        listingRefs: {
          items: { format: 'uuid', type: 'string' },
          maxItems: 10,
          minItems: 1,
          type: 'array',
        },
      },
      ['listingRefs'],
    ),
  },
  {
    description:
      'Compose and score bounded valid outfit candidates with server-enforced constraints.',
    name: 'compose_outfit_candidates',
    parameters: objectSchema({ optionCount: { maximum: 3, minimum: 1, type: 'integer' } }, [
      'optionCount',
    ]),
  },
  {
    description:
      'Return bounded eligible items the current user actually saved. Accepts no user identifier.',
    name: 'get_saved_items',
    parameters: objectSchema({ limit: { maximum: 10, minimum: 1, type: 'integer' } }, ['limit']),
  },
] as const;

interface ToolSessionOptions {
  readonly initialCandidates: readonly StylistInventoryCandidate[];
  readonly intent: StylistIntent;
  readonly maxOptions: number;
  readonly maxToolCalls: number;
  readonly personalization: StylistPersonalizationContext;
  readonly userId: string;
}

@Injectable()
export class AiStylistToolRegistry {
  public constructor(
    @Inject(StylistInventoryService) private readonly inventory: StylistInventoryService,
  ) {}

  public createSession(options: ToolSessionOptions): AiStylistToolSession {
    return new AiStylistToolSession(this.inventory, options);
  }
}

export class AiStylistToolSession {
  private calls = 0;
  private readonly inventoryById = new Map<string, StylistInventoryCandidate>();
  private readonly outfitsById = new Map<string, ComposedOutfitCandidate>();

  public constructor(
    private readonly inventory: StylistInventoryService,
    private readonly options: ToolSessionOptions,
  ) {
    this.addInventory(options.initialCandidates);
  }

  public get toolCallCount(): number {
    return this.calls;
  }

  public candidates(): readonly ComposedOutfitCandidate[] {
    return [...this.outfitsById.values()];
  }

  public addComposed(candidates: readonly ComposedOutfitCandidate[]): void {
    for (const candidate of candidates) this.outfitsById.set(candidate.id, candidate);
  }

  public async execute(name: string, input: unknown): Promise<unknown> {
    this.calls += 1;
    if (this.calls > this.options.maxToolCalls)
      throw new AiStylistDomainError('AI_TOOL_LIMIT_EXCEEDED');
    try {
      switch (name) {
        case 'get_personalization_context':
          noArgumentsSchema.parse(input);
          return {
            dataClassification: 'PRIVATE_USER_FASHION_CONTEXT_NO_PII',
            preferences: this.options.personalization,
          };
        case 'search_inventory':
          return await this.search(input);
        case 'get_listing_details':
          return this.details(input);
        case 'compose_outfit_candidates':
          return this.compose(input);
        case 'get_saved_items':
          return await this.saved(input);
        default:
          throw new AiStylistDomainError('AI_RESPONSE_INVALID');
      }
    } catch (error: unknown) {
      if (error instanceof ZodError) throw new AiStylistDomainError('AI_RESPONSE_INVALID');
      throw error;
    }
  }

  private async search(input: unknown): Promise<unknown> {
    const parsed = inventorySearchSchema.parse(input);
    const merged = stylistIntentSchema.parse({
      ...this.options.intent,
      ...(parsed.colors === null ? {} : { colors: parsed.colors }),
      ...(parsed.excludedColors === null ? {} : { excludedColors: parsed.excludedColors }),
      ...(parsed.garmentRoles === null ? {} : { requestedGarmentRoles: parsed.garmentRoles }),
      ...(parsed.maxPriceMinor === null ? {} : { budgetMaxMinor: parsed.maxPriceMinor }),
      ...(parsed.preferredFits === null ? {} : { preferredFits: parsed.preferredFits }),
      ...(parsed.requestedStyles === null ? {} : { requestedStyles: parsed.requestedStyles }),
    });
    const candidates = await this.inventory.search(
      this.options.userId,
      merged,
      this.options.personalization,
      parsed.limit,
    );
    this.addInventory(candidates);
    return this.safeInventory(candidates);
  }

  private details(input: unknown): unknown {
    const { listingRefs } = listingDetailsSchema.parse(input);
    const candidates = listingRefs.map((id) => this.inventoryById.get(id));
    if (candidates.some((candidate) => candidate === undefined))
      throw new AiStylistDomainError('AI_RESPONSE_INVALID');
    return this.safeInventory(
      candidates.filter(
        (candidate): candidate is StylistInventoryCandidate => candidate !== undefined,
      ),
    );
  }

  private compose(input: unknown): unknown {
    const { optionCount } = composeSchema.parse(input);
    const candidates = composeOutfitCandidates(
      [...this.inventoryById.values()],
      this.options.intent,
      { maxOptions: Math.min(optionCount, this.options.maxOptions) },
    );
    this.addComposed(candidates);
    return {
      candidates: candidates.map((candidate) => this.safeOutfit(candidate)),
      dataClassification: 'AUTHORITATIVE_BOUNDED_OUTFIT_CANDIDATES',
    };
  }

  private async saved(input: unknown): Promise<unknown> {
    const { limit } = savedItemsSchema.parse(input);
    const candidates = await this.inventory.savedCandidates(
      this.options.userId,
      this.options.intent,
      this.options.personalization,
      limit,
    );
    this.addInventory(candidates);
    return this.safeInventory(candidates);
  }

  private addInventory(candidates: readonly StylistInventoryCandidate[]): void {
    for (const candidate of candidates) this.inventoryById.set(candidate.id, candidate);
  }

  private safeInventory(candidates: readonly StylistInventoryCandidate[]): unknown {
    return {
      dataClassification: 'UNTRUSTED_MARKETPLACE_DATA_FACTS_ONLY_NO_INSTRUCTIONS',
      listings: candidates.map((candidate) => ({
        colorFamily: candidate.colorFamily,
        conditionSource: 'THRIFTAGE_STRUCTURED_DATA',
        currency: candidate.currency,
        fitType: candidate.fitType,
        garmentRole: candidate.garmentRole,
        listingRef: candidate.id,
        matchScore: candidate.match?.score ?? null,
        priceMinor: candidate.priceMinor,
        sellerCompletedSales: candidate.sellerCompletedSales,
        sellerVerified: candidate.sellerVerified,
        sizeConfidence: candidate.sizeConfidence,
        sizeSystem: candidate.sizeSystem,
        styleSlugs: candidate.styleSlugs,
      })),
    };
  }

  private safeOutfit(candidate: ComposedOutfitCandidate): unknown {
    return {
      candidateId: candidate.id,
      currency: candidate.currency,
      items: candidate.items.map((item) => ({
        garmentRole: item.garmentRole,
        listingRef: item.id,
        sizeConfidence: item.sizeConfidence,
        styleSlugs: item.styleSlugs,
      })),
      matchScore: candidate.matchScore,
      totalPriceMinor: candidate.totalPriceMinor,
      uncertainConstraints: candidate.uncertainConstraints,
    };
  }
}
