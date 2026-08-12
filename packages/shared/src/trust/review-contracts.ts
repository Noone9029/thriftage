import { z } from 'zod';

export const reviewDirectionValues = ['BUYER_TO_SELLER', 'SELLER_TO_BUYER'] as const;
export const reviewModerationStateValues = ['VISIBLE', 'TEXT_HIDDEN', 'INVALIDATED'] as const;
export const reviewReportReasonValues = [
  'HARASSMENT',
  'HATE_OR_ABUSE',
  'PERSONAL_INFORMATION',
  'SPAM',
  'IRRELEVANT',
  'FRAUDULENT',
  'RETALIATION',
  'OTHER',
] as const;
export const reviewReportStatusValues = ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED'] as const;
export const reviewRatingSchema = z.number().int().min(1).max(5);
export const reviewTextSchema = z.string().trim().min(3).max(1000).optional();
export const reviewCreateInputSchema = z.strictObject({
  orderId: z.string().uuid(),
  rating: reviewRatingSchema,
  text: reviewTextSchema,
});
export const reviewSchema = z.strictObject({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  revieweeId: z.string().uuid(),
  reviewerUsername: z.string(),
  revieweeUsername: z.string(),
  direction: z.enum(reviewDirectionValues),
  rating: reviewRatingSchema,
  text: z.string().nullable(),
  moderationState: z.enum(reviewModerationStateValues),
  createdAt: z.string().datetime({ offset: true }),
});
export const ratingSummarySchema = z.strictObject({
  average: z.number().min(1).max(5).nullable(),
  count: z.number().int().nonnegative(),
  distribution: z.record(z.enum(['1', '2', '3', '4', '5']), z.number().int().nonnegative()),
});
export const reviewEligibilitySchema = z.strictObject({
  eligible: z.boolean(),
  review: reviewSchema.nullable(),
  direction: z.enum(reviewDirectionValues).nullable(),
});
export const reviewPageSchema = z.strictObject({
  items: z.array(reviewSchema),
  nextCursor: z.string().nullable(),
  summary: ratingSummarySchema,
});
export const reviewReportInputSchema = z.strictObject({
  reason: z.enum(reviewReportReasonValues),
  detail: z.string().trim().min(3).max(1000).optional(),
});
export const reviewReportSchema = z.strictObject({
  id: z.string().uuid(),
  reviewId: z.string().uuid(),
  reporterId: z.string().uuid(),
  reason: z.enum(reviewReportReasonValues),
  detail: z.string().nullable(),
  status: z.enum(reviewReportStatusValues),
  createdAt: z.string().datetime({ offset: true }),
});
export const reviewAdminActionSchema = z.strictObject({
  action: z.enum(['HIDE_TEXT', 'RESTORE', 'INVALIDATE', 'DISMISS_REPORT']),
  reason: z.string().trim().min(3).max(1000),
  reportId: z.string().uuid().optional(),
});
export const reviewQuerySchema = z.strictObject({
  direction: z.enum(reviewDirectionValues).default('BUYER_TO_SELLER'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const reviewReportQuerySchema = z.strictObject({
  status: z.enum(reviewReportStatusValues).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const adminReviewReportItemSchema = z.strictObject({
  report: reviewReportSchema,
  review: reviewSchema,
  reporterUsername: z.string().nullable(),
});
export const adminReviewReportPageSchema = z.strictObject({
  items: z.array(adminReviewReportItemSchema),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateInputSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type RatingSummary = z.infer<typeof ratingSummarySchema>;
export type ReviewReportInput = z.infer<typeof reviewReportInputSchema>;
export type ReviewAdminAction = z.infer<typeof reviewAdminActionSchema>;
export type ReviewEligibility = z.infer<typeof reviewEligibilitySchema>;
export type ReviewPage = z.infer<typeof reviewPageSchema>;
export type ReviewReport = z.infer<typeof reviewReportSchema>;
export type AdminReviewReportItem = z.infer<typeof adminReviewReportItemSchema>;
