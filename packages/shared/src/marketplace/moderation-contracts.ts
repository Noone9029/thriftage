import { z } from 'zod';

import { categorySchema } from './category-contracts';
import { cursorPageQuerySchema, listingDetailSchema } from './listing-contracts';

export const reportTargetTypeValues = ['LISTING', 'USER'] as const;
export const reportReasonValues = [
  'COUNTERFEIT',
  'FRAUD_OR_SCAM',
  'PROHIBITED_ITEM',
  'MISLEADING_CONTENT',
  'HARASSMENT',
  'SPAM',
  'OTHER',
] as const;
export const moderationReportStatusValues = [
  'OPEN',
  'UNDER_REVIEW',
  'ACTIONED',
  'DISMISSED',
] as const;

export const reportTargetTypeSchema = z.enum(reportTargetTypeValues);
export const reportReasonSchema = z.enum(reportReasonValues);
export const moderationReportStatusSchema = z.enum(moderationReportStatusValues);

const reportFields = {
  detail: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  reason: reportReasonSchema,
} as const;

export const listingReportInputSchema = z.strictObject({
  ...reportFields,
  listingId: z.string().uuid(),
});

export const userReportInputSchema = z.strictObject({
  ...reportFields,
  userId: z.string().uuid(),
});

export const moderationReportSchema = z.strictObject({
  assignedAdminId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  detail: z.string().nullable(),
  id: z.string().uuid(),
  listingId: z.string().uuid().nullable(),
  reason: reportReasonSchema,
  reporterId: z.string().uuid(),
  resolution: z.string().nullable(),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
  status: moderationReportStatusSchema,
  targetType: reportTargetTypeSchema,
  targetUserId: z.string().uuid().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const moderationReportPageSchema = z.strictObject({
  items: z.array(moderationReportSchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const moderationReportQuerySchema = cursorPageQuerySchema.extend({
  status: moderationReportStatusSchema.optional(),
  targetType: reportTargetTypeSchema.optional(),
});

export const moderationReportUpdateInputSchema = z
  .strictObject({
    resolution: z.string().trim().min(5).max(1000).optional(),
    status: z.enum(['UNDER_REVIEW', 'ACTIONED', 'DISMISSED']),
  })
  .superRefine(({ resolution, status }, context) => {
    if ((status === 'ACTIONED' || status === 'DISMISSED') && resolution === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'A resolution is required when closing a report.',
        path: ['resolution'],
      });
    }
  });

export const adminListingQueueItemSchema = listingDetailSchema.extend({
  openReportCount: z.number().int().nonnegative(),
});

export const adminListingQueueSchema = z.strictObject({
  items: z.array(adminListingQueueItemSchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const adminCategoryPageSchema = z.array(categorySchema);

export const moderationAuditSchema = z.strictObject({
  action: z.string().min(1),
  actorId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  nextState: z.string().nullable(),
  previousState: z.string().nullable(),
  reason: z.string().nullable(),
});

export const adminListingDetailSchema = z.strictObject({
  audits: z.array(moderationAuditSchema),
  listing: adminListingQueueItemSchema,
});

export type AdminListingDetail = z.infer<typeof adminListingDetailSchema>;

export type AdminListingQueueItem = z.infer<typeof adminListingQueueItemSchema>;
export type ListingReportInput = z.infer<typeof listingReportInputSchema>;
export type ModerationReport = z.infer<typeof moderationReportSchema>;
export type ModerationReportQuery = z.infer<typeof moderationReportQuerySchema>;
export type ModerationReportStatus = z.infer<typeof moderationReportStatusSchema>;
export type ModerationReportUpdateInput = z.infer<typeof moderationReportUpdateInputSchema>;
export type UserReportInput = z.infer<typeof userReportInputSchema>;
