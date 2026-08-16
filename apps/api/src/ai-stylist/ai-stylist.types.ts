import { z } from 'zod';
import type {
  AiStylistQuickRefinement,
  CurrencyCode,
  ListingDetail,
  ListingMatch,
  StylistIntent,
} from '@thriftage/shared';

export interface StylistPersonalizationContext {
  readonly budgetMaxMinor: number | null;
  readonly budgetMinMinor: number | null;
  readonly colors: readonly {
    readonly colorFamily: string;
    readonly sentiment: 'PREFER' | 'AVOID';
  }[];
  readonly currency: CurrencyCode;
  readonly fits: readonly string[];
  readonly profileVersion: number | null;
  readonly sizes: readonly {
    readonly garmentRole: string;
    readonly sizeKey: string;
    readonly sizeSystem: string;
  }[];
  readonly styles: readonly { readonly slug: string; readonly strength: number }[];
}

export interface StylistInventoryCandidate {
  readonly colorFamily: string | null;
  readonly currency: CurrencyCode;
  readonly fitType: string | null;
  readonly garmentRole: string;
  readonly id: string;
  readonly match: ListingMatch | null;
  readonly priceMinor: number;
  readonly sellerCompletedSales: number;
  readonly sellerId: string;
  readonly sellerVerified: boolean;
  readonly sizeCompatibilityKey: string | null;
  readonly sizeConfidence: 'MATCH' | 'MISMATCH' | 'UNKNOWN';
  readonly sizeSystem: string | null;
  readonly styleSlugs: readonly string[];
}

export interface ComposedOutfitCandidate {
  readonly currency: CurrencyCode;
  readonly id: string;
  readonly items: readonly StylistInventoryCandidate[];
  readonly matchScore: number;
  readonly totalPriceMinor: number;
  readonly uncertainConstraints: readonly string[];
}

export const providerStylistPlanSchema = z.strictObject({
  assistantMessage: z.string().trim().min(1).max(1800),
  kind: z.enum(['OUTFITS', 'CLARIFICATION', 'NO_MATCH', 'REFUSAL']),
  quickRefinements: z
    .array(
      z.enum([
        'CHEAPER',
        'MORE_FORMAL',
        'MORE_CASUAL',
        'MORE_MODEST',
        'DIFFERENT_COLORS',
        'DIFFERENT_SHOES',
        'ANOTHER_OPTION',
      ]),
    )
    .max(6),
  selections: z
    .array(
      z.strictObject({
        candidateId: z.string().uuid(),
        explanation: z.string().trim().min(1).max(1000),
        title: z.string().trim().min(1).max(120),
      }),
    )
    .max(3),
});

export type ProviderStylistPlan = z.infer<typeof providerStylistPlanSchema>;

export interface AiProviderUsage {
  readonly cachedInputTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiProviderToolDefinition {
  readonly description: string;
  readonly name: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface AiProviderRequest {
  readonly conversationSummary: Readonly<Record<string, unknown>>;
  readonly generationId: string;
  readonly initialCandidates: readonly ComposedOutfitCandidate[];
  readonly intent: StylistIntent;
  readonly maxOutputTokens: number;
  readonly maxToolCalls: number;
  readonly model: string;
  readonly reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  readonly safetyIdentifier: string;
  readonly systemPrompt: string;
  readonly timeoutMs: number;
  readonly tools: readonly AiProviderToolDefinition[];
  readonly userMessage: string;
}

export interface AiProviderResult {
  readonly latencyMs: number;
  readonly plan: ProviderStylistPlan;
  readonly returnedModel: string | null;
  readonly toolCallCount: number;
  readonly usage: AiProviderUsage;
}

export type AiToolExecutor = (name: string, input: unknown) => Promise<unknown>;

export interface AiStylistProvider {
  generate(request: AiProviderRequest, executeTool: AiToolExecutor): Promise<AiProviderResult>;
}

export const AI_STYLIST_PROVIDER = Symbol('AI_STYLIST_PROVIDER');

export interface ValidatedOutfitPresentation {
  readonly candidate: ComposedOutfitCandidate;
  readonly listings: ReadonlyMap<string, ListingDetail>;
}

export interface FinalStylistResponse {
  readonly copy: string;
  readonly fallbackUsed: boolean;
  readonly kind: 'OUTFITS' | 'CLARIFICATION' | 'NO_MATCH' | 'REFUSAL';
  readonly outfits: readonly {
    readonly candidate: ComposedOutfitCandidate;
    readonly explanation: string;
    readonly listings: ReadonlyMap<string, ListingDetail>;
    readonly title: string;
  }[];
  readonly quickRefinements: readonly AiStylistQuickRefinement[];
}
