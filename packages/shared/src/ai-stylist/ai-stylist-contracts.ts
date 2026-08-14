import { z } from 'zod';

import {
  colorFamilySchema,
  fitTypeSchema,
  garmentRoleSchema,
  sizeSystemSchema,
} from '../personalization/personalization-contracts';
import { currencyCodeSchema, listingDetailSchema } from '../marketplace/listing-contracts';

export const aiStylistOccasionValues = [
  'UNIVERSITY',
  'WORK',
  'WEDDING',
  'DATE_NIGHT',
  'TRAVEL',
  'GYM',
  'CASUAL_DAY',
  'FORMAL_EVENT',
  'DINNER',
  'PARTY',
] as const;
export const aiStylistRefinementValues = [
  'NONE',
  'CHEAPER',
  'MORE_FORMAL',
  'MORE_CASUAL',
  'MORE_MODEST',
  'DIFFERENT_COLORS',
  'DIFFERENT_SHOES',
  'ANOTHER_OPTION',
  'BOLDER',
  'STYLE_SHIFT',
] as const;
export const aiStylistQuickRefinementValues = [
  'CHEAPER',
  'MORE_FORMAL',
  'MORE_CASUAL',
  'MORE_MODEST',
  'DIFFERENT_COLORS',
  'DIFFERENT_SHOES',
  'ANOTHER_OPTION',
] as const;
export const aiStylistResponseKindValues = [
  'OUTFITS',
  'CLARIFICATION',
  'NO_MATCH',
  'REFUSAL',
] as const;
export const aiStylistGenerationStatusValues = [
  'PROCESSING',
  'SUCCEEDED',
  'FALLBACK',
  'FAILED',
  'CANCELLED',
  'REFUSED',
] as const;
export const aiStylistAttributionEventValues = ['OPEN', 'SAVE', 'CHECKOUT', 'PURCHASE'] as const;

export const aiStylistOccasionSchema = z.enum(aiStylistOccasionValues);
export const aiStylistRefinementSchema = z.enum(aiStylistRefinementValues);
export const aiStylistQuickRefinementSchema = z.enum(aiStylistQuickRefinementValues);
export const aiStylistResponseKindSchema = z.enum(aiStylistResponseKindValues);
export const aiStylistGenerationStatusSchema = z.enum(aiStylistGenerationStatusValues);
export const aiStylistAttributionEventSchema = z.enum(aiStylistAttributionEventValues);

export const stylistSizeConstraintSchema = z.strictObject({
  garmentRole: garmentRoleSchema,
  sizeKey: z.string().trim().min(1).max(40),
  sizeSystem: sizeSystemSchema,
});

export const stylistIntentSchema = z.strictObject({
  anchorListingId: z.string().uuid().nullable(),
  budgetMaxMinor: z.number().int().positive().nullable(),
  budgetMinMinor: z.number().int().nonnegative().nullable(),
  colors: z.array(colorFamilySchema).max(5),
  currency: currencyCodeSchema,
  excludedColors: z.array(colorFamilySchema).max(5),
  freeTextObjective: z.string().trim().min(1).max(2000),
  lockedListingIds: z.array(z.string().uuid()).max(6),
  modesty: z.boolean().nullable(),
  occasion: aiStylistOccasionSchema.nullable(),
  optionCount: z.number().int().min(1).max(3),
  preferredFits: z.array(fitTypeSchema).max(5),
  refinement: aiStylistRefinementSchema,
  requestedGarmentRoles: z.array(garmentRoleSchema).max(8),
  requestedStyles: z.array(z.string().trim().min(1).max(60)).max(5),
  sizeConstraints: z.array(stylistSizeConstraintSchema).max(8),
});

export const aiStylistConversationCreateInputSchema = z.strictObject({
  anchorListingId: z.string().uuid().optional(),
});

export const aiStylistMessageInputSchema = z.strictObject({
  anchorListingId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(2000),
  requestId: z.string().uuid(),
});

export const aiStylistConversationQuerySchema = z.strictObject({
  cursor: z.string().trim().max(2048).optional(),
  includeArchived: z.preprocess(
    (value) => (value === 'true' ? true : value === 'false' || value === undefined ? false : value),
    z.boolean(),
  ),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export const aiStylistOutfitItemSchema = z.strictObject({
  available: z.boolean(),
  listing: listingDetailSchema,
  position: z.number().int().min(0).max(9),
  role: garmentRoleSchema,
  uncertainConstraints: z.array(z.string().trim().min(1).max(160)).max(5),
});

export const aiStylistOutfitSchema = z.strictObject({
  currency: currencyCodeSchema.nullable(),
  explanation: z.string().trim().min(1).max(1000),
  id: z.string().uuid(),
  items: z.array(aiStylistOutfitItemSchema).min(1).max(8),
  matchScore: z.number().int().min(0).max(100),
  title: z.string().trim().min(1).max(120),
  totalPriceMinor: z.number().int().nonnegative().nullable(),
  unmetConstraints: z.array(z.string().trim().min(1).max(160)).max(8),
});

export const aiStylistAssistantPayloadSchema = z.strictObject({
  fallbackUsed: z.boolean(),
  generationId: z.string().uuid(),
  kind: aiStylistResponseKindSchema,
  outfits: z.array(aiStylistOutfitSchema).max(3),
  promptVersion: z.string().trim().min(1).max(60),
  quickRefinements: z.array(aiStylistQuickRefinementSchema).max(6),
});

export const aiStylistMessageSchema = z.strictObject({
  assistantPayload: aiStylistAssistantPayloadSchema.nullable(),
  content: z.string().max(4000),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  role: z.enum(['USER', 'ASSISTANT']),
});

export const aiStylistConversationSummarySchema = z.strictObject({
  archivedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  preview: z.string().max(180).nullable(),
  title: z.string().min(1).max(120),
  updatedAt: z.string().datetime({ offset: true }),
});

export const aiStylistConversationDetailSchema = aiStylistConversationSummarySchema.extend({
  messages: z.array(aiStylistMessageSchema).max(100),
});

export const aiStylistConversationPageSchema = z.strictObject({
  items: z.array(aiStylistConversationSummarySchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const aiStylistGenerationResultSchema = z.strictObject({
  conversation: aiStylistConversationSummarySchema,
  message: aiStylistMessageSchema,
  status: aiStylistGenerationStatusSchema,
});

export const savedOutfitItemSchema = z.strictObject({
  available: z.boolean(),
  id: z.string().uuid(),
  listing: listingDetailSchema.nullable(),
  listingReferenceId: z.string().uuid(),
  position: z.number().int().min(0).max(9),
  role: garmentRoleSchema,
});

export const savedOutfitSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  items: z.array(savedOutfitItemSchema).min(1).max(8),
  sourceGenerationId: z.string().uuid().nullable(),
  sourceOutfitId: z.string().uuid(),
  title: z.string().min(1).max(120),
  updatedAt: z.string().datetime({ offset: true }),
});

export const savedOutfitPageSchema = z.strictObject({
  items: z.array(savedOutfitSchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const saveOutfitInputSchema = z.strictObject({
  generationId: z.string().uuid(),
  outfitId: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
});

export const replaceSavedOutfitItemInputSchema = z.strictObject({
  requestId: z.string().uuid(),
});

export const aiStylistAttributionInputSchema = z
  .strictObject({
    event: aiStylistAttributionEventSchema,
    generationId: z.string().uuid(),
    listingId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
  })
  .superRefine(({ event, orderId }, context) => {
    const orderRequired = event === 'CHECKOUT' || event === 'PURCHASE';
    if (orderRequired !== (orderId !== undefined))
      context.addIssue({
        code: 'custom',
        message: 'Order attribution must match the event type.',
        path: ['orderId'],
      });
  });

export const aiStylistRuntimeConfigurationSchema = z.strictObject({
  dailyBudgetMicroUsd: z.number().int().positive().nullable(),
  dailyUserLimit: z.number().int().positive(),
  enabled: z.boolean(),
  evalVersion: z.string().min(1).max(60),
  maxConcurrentGenerations: z.number().int().positive(),
  maxInputCharacters: z.number().int().positive(),
  maxOutfitOptions: z.number().int().min(1).max(5),
  maxOutputTokens: z.number().int().positive(),
  maxRequestsPerMinute: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  model: z.string().min(1).max(100),
  promptVersion: z.string().min(1).max(60),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high', 'xhigh', 'max']),
  sessionTurnLimit: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  toolSchemaVersion: z.string().min(1).max(60),
});

const groupedAiMetricSchema = z.strictObject({
  count: z.number().int().nonnegative(),
  key: z.string().min(1),
});

export const aiStylistAdminMetricsSchema = z.strictObject({
  activeUsers: z.number().int().nonnegative(),
  attribution: z.array(groupedAiMetricSchema),
  averageLatencyMs: z.number().nonnegative().nullable(),
  cachedInputTokens: z.number().int().nonnegative(),
  configuration: aiStylistRuntimeConfigurationSchema,
  estimatedCostMicroUsd: z.number().int().nonnegative(),
  fallbackRate: z.number().min(0).max(1),
  generations: z.number().int().nonnegative(),
  generationsByModel: z.array(groupedAiMetricSchema),
  generationsByStatus: z.array(groupedAiMetricSchema),
  inputTokens: z.number().int().nonnegative(),
  latencyP50Ms: z.number().nonnegative().nullable(),
  latencyP95Ms: z.number().nonnegative().nullable(),
  listingClickThroughRate: z.number().min(0).max(1),
  outfitSaveRate: z.number().min(0).max(1),
  outputTokens: z.number().int().nonnegative(),
  providerErrorRate: z.number().min(0).max(1),
  savedOutfits: z.number().int().nonnegative(),
});

export const aiStylistErrorCodeValues = [
  'AI_STYLIST_DISABLED',
  'AI_RATE_LIMITED',
  'AI_GENERATION_IN_PROGRESS',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_PROVIDER_TIMEOUT',
  'AI_RESPONSE_INVALID',
  'AI_TOOL_LIMIT_EXCEEDED',
  'AI_INVENTORY_UNAVAILABLE',
  'AI_CONVERSATION_NOT_FOUND',
  'AI_CONVERSATION_FORBIDDEN',
  'AI_OUTFIT_NOT_FOUND',
  'AI_REQUEST_NOT_SUPPORTED',
] as const;
export const aiStylistErrorCodeSchema = z.enum(aiStylistErrorCodeValues);

export type AiStylistAdminMetrics = z.infer<typeof aiStylistAdminMetricsSchema>;
export type AiStylistAssistantPayload = z.infer<typeof aiStylistAssistantPayloadSchema>;
export type AiStylistAttributionInput = z.infer<typeof aiStylistAttributionInputSchema>;
export type AiStylistConversationCreateInput = z.infer<
  typeof aiStylistConversationCreateInputSchema
>;
export type AiStylistConversationDetail = z.infer<typeof aiStylistConversationDetailSchema>;
export type AiStylistConversationPage = z.infer<typeof aiStylistConversationPageSchema>;
export type AiStylistConversationQuery = z.infer<typeof aiStylistConversationQuerySchema>;
export type AiStylistConversationSummary = z.infer<typeof aiStylistConversationSummarySchema>;
export type AiStylistErrorCode = z.infer<typeof aiStylistErrorCodeSchema>;
export type AiStylistGenerationResult = z.infer<typeof aiStylistGenerationResultSchema>;
export type AiStylistMessage = z.infer<typeof aiStylistMessageSchema>;
export type AiStylistMessageInput = z.infer<typeof aiStylistMessageInputSchema>;
export type AiStylistOutfit = z.infer<typeof aiStylistOutfitSchema>;
export type AiStylistQuickRefinement = z.infer<typeof aiStylistQuickRefinementSchema>;
export type AiStylistRuntimeConfiguration = z.infer<typeof aiStylistRuntimeConfigurationSchema>;
export type SavedOutfit = z.infer<typeof savedOutfitSchema>;
export type SavedOutfitPage = z.infer<typeof savedOutfitPageSchema>;
export type ReplaceSavedOutfitItemInput = z.infer<typeof replaceSavedOutfitItemInputSchema>;
export type SaveOutfitInput = z.infer<typeof saveOutfitInputSchema>;
export type StylistIntent = z.infer<typeof stylistIntentSchema>;
