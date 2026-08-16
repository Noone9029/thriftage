import { z } from 'zod';

export const feedbackReviewStatusValues = [
  'OPEN',
  'UNDER_REVIEW',
  'ACTIONED',
  'DISMISSED',
] as const;
export const betaFeedbackCategoryValues = [
  'BUG',
  'USABILITY',
  'PERFORMANCE',
  'SAFETY',
  'OTHER',
] as const;
export const feedbackClientPlatformValues = ['IOS', 'ANDROID', 'WEB'] as const;
export const aiResponseFeedbackKindValues = ['HELPFUL', 'NOT_HELPFUL', 'REPORT'] as const;

export const feedbackErrorCodeValues = [
  'FEEDBACK_GENERATION_NOT_FOUND',
  'FEEDBACK_NOT_FOUND',
  'FEEDBACK_RATE_LIMITED',
  'FEEDBACK_SERVICE_ERROR',
  'FEEDBACK_TRANSITION_INVALID',
  'FEEDBACK_VALIDATION_FAILED',
] as const;
export const feedbackErrorCodeSchema = z.enum(feedbackErrorCodeValues);

export const betaFeedbackInputSchema = z.strictObject({
  appVersion: z.string().trim().min(1).max(40),
  buildNumber: z.string().trim().min(1).max(40),
  category: z.enum(betaFeedbackCategoryValues),
  description: z.string().trim().min(10).max(2000),
  platform: z.enum(feedbackClientPlatformValues),
  route: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[-A-Za-z0-9_./[\]]*$/, 'Route must be a path without query parameters.')
    .optional(),
});

export const betaFeedbackSchema = betaFeedbackInputSchema.extend({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  status: z.enum(feedbackReviewStatusValues),
});

export const aiResponseFeedbackInputSchema = z
  .strictObject({
    kind: z.enum(aiResponseFeedbackKindValues),
    reason: z.string().trim().min(3).max(1000).optional(),
  })
  .superRefine((input, context) => {
    if (input.kind === 'REPORT' && input.reason === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Explain why this AI response should be reviewed.',
        path: ['reason'],
      });
    }
  });

export const aiResponseFeedbackSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  generationId: z.string().uuid(),
  id: z.string().uuid(),
  kind: z.enum(aiResponseFeedbackKindValues),
  reason: z.string().nullable(),
  status: z.enum(feedbackReviewStatusValues),
});

export const feedbackModerationInputSchema = z
  .strictObject({
    resolution: z.string().trim().min(3).max(1000).optional(),
    status: z.enum(['UNDER_REVIEW', 'ACTIONED', 'DISMISSED']),
  })
  .superRefine((input, context) => {
    if (input.status !== 'UNDER_REVIEW' && input.resolution === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'A resolution is required when closing feedback.',
        path: ['resolution'],
      });
    }
  });

export const adminBetaFeedbackSchema = betaFeedbackSchema.extend({
  resolution: z.string().nullable(),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  userId: z.string().uuid(),
});

export const adminAiResponseFeedbackSchema = aiResponseFeedbackSchema.extend({
  generation: z.strictObject({
    failureCode: z.string().nullable(),
    promptVersion: z.string(),
    provider: z.string(),
    requestedModel: z.string(),
    status: z.string(),
  }),
  resolution: z.string().nullable(),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  userId: z.string().uuid(),
});

export const feedbackQueueQuerySchema = z.strictObject({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(feedbackReviewStatusValues).optional(),
});

export const adminBetaFeedbackPageSchema = z.strictObject({
  items: z.array(adminBetaFeedbackSchema),
  nextCursor: z.string().nullable(),
});

export const adminAiResponseFeedbackPageSchema = z.strictObject({
  items: z.array(adminAiResponseFeedbackSchema),
  nextCursor: z.string().nullable(),
});

export type BetaFeedbackInput = z.infer<typeof betaFeedbackInputSchema>;
export type BetaFeedback = z.infer<typeof betaFeedbackSchema>;
export type AiResponseFeedbackInput = z.infer<typeof aiResponseFeedbackInputSchema>;
export type AiResponseFeedback = z.infer<typeof aiResponseFeedbackSchema>;
export type FeedbackModerationInput = z.infer<typeof feedbackModerationInputSchema>;
export type FeedbackReviewStatus = (typeof feedbackReviewStatusValues)[number];
export type AdminBetaFeedback = z.infer<typeof adminBetaFeedbackSchema>;
export type AdminAiResponseFeedback = z.infer<typeof adminAiResponseFeedbackSchema>;
export type FeedbackErrorCode = z.infer<typeof feedbackErrorCodeSchema>;
export type FeedbackQueueQuery = z.infer<typeof feedbackQueueQuerySchema>;
export type AdminBetaFeedbackPage = z.infer<typeof adminBetaFeedbackPageSchema>;
export type AdminAiResponseFeedbackPage = z.infer<typeof adminAiResponseFeedbackPageSchema>;
