import { z } from 'zod';
import { ratingSummarySchema } from './review-contracts';

export const restrictionScopeValues = ['MESSAGING', 'SELLING', 'BUYING', 'SOCIAL'] as const;
export const safetyActionTypeValues = [
  'WARNING',
  'TEMPORARY_RESTRICTION',
  'PERMANENT_RESTRICTION',
  'ACCOUNT_SUSPENSION',
  'RESTRICTION_REVOKED',
] as const;
export const safetyErrorCodeValues = [
  'BLOCK_FORBIDDEN',
  'BLOCK_NOT_FOUND',
  'INTERACTION_NOT_AVAILABLE',
  'POLICY_ACCEPTANCE_REQUIRED',
  'POLICY_CONFIGURATION_REQUIRED',
  'RESTRICTION_NOT_FOUND',
  'ADMIN_USER_NOT_FOUND',
  'SAFETY_SERVICE_ERROR',
  'SAFETY_VALIDATION_FAILED',
] as const;
export type SafetyErrorCode = (typeof safetyErrorCodeValues)[number];
export const userBlockSchema = z.strictObject({
  blockedUserId: z.string().uuid(),
  username: z.string(),
  profileImageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export const blockPageSchema = z.strictObject({ items: z.array(userBlockSchema) });
export const restrictionSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  scope: z.enum(restrictionScopeValues),
  reason: z.string(),
  startsAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  revokedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export const restrictionInputSchema = z.strictObject({
  scope: z.enum(restrictionScopeValues),
  reason: z.string().trim().min(3).max(1000),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  linkedDisputeId: z.string().uuid().optional(),
  linkedReportId: z.string().uuid().optional(),
});
export const safetyActionInputSchema = z.strictObject({
  action: z.enum(['WARNING', 'ACCOUNT_SUSPENSION']),
  reason: z.string().trim().min(3).max(1000),
  linkedDisputeId: z.string().uuid().optional(),
  linkedReportId: z.string().uuid().optional(),
});
export const safetyHistoryActionSchema = z.strictObject({
  id: z.string().uuid(),
  type: z.enum(safetyActionTypeValues),
  reason: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});
export const safetyStatusSchema = z.strictObject({
  actions: z.array(safetyHistoryActionSchema),
  restrictions: z.array(restrictionSchema),
  supportUrl: z.string().url().nullable(),
});
export const trustMetricsSchema = z.strictObject({
  openReviewReports: z.number().int(),
  openDisputes: z.number().int(),
  pendingVerifications: z.number().int(),
  activeRestrictions: z.number().int(),
  suspendedAccounts: z.number().int(),
});
export const adminUserSummarySchema = z.strictObject({
  id: z.string().uuid(),
  username: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  completedSales: z.number().int(),
  completedPurchases: z.number().int(),
  sellerRating: ratingSummarySchema,
  buyerRating: ratingSummarySchema,
  sellerVerified: z.boolean(),
  activeRestrictions: z.array(restrictionSchema),
});
export const adminSafetyActionSchema = z.strictObject({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  type: z.enum(safetyActionTypeValues),
  reason: z.string(),
  restrictionId: z.string().uuid().nullable(),
  reportId: z.string().uuid().nullable(),
  disputeId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export const adminUserDetailSchema = adminUserSummarySchema.extend({
  memberSince: z.string().datetime({ offset: true }),
  bio: z.string().nullable(),
  university: z.string().nullable(),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).nullable(),
  reportsReceived: z.number().int().nonnegative(),
  disputeCount: z.number().int().nonnegative(),
  safetyActions: z.array(adminSafetyActionSchema),
});
export const adminUserPageSchema = z.strictObject({
  items: z.array(adminUserSummarySchema),
});
export const adminUserQuerySchema = z.strictObject({
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type RestrictionInput = z.infer<typeof restrictionInputSchema>;
export type SafetyActionInput = z.infer<typeof safetyActionInputSchema>;
export type Restriction = z.infer<typeof restrictionSchema>;
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type UserBlock = z.infer<typeof userBlockSchema>;
export type SafetyStatus = z.infer<typeof safetyStatusSchema>;
export type TrustMetrics = z.infer<typeof trustMetricsSchema>;
