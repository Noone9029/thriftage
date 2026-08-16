import { z } from 'zod';

export const sellerVerificationErrorCodeValues = [
  'VERIFICATION_ALREADY_ACTIVE',
  'VERIFICATION_DISABLED',
  'VERIFICATION_NOT_ELIGIBLE',
  'VERIFICATION_NOT_FOUND',
  'VERIFICATION_REAPPLY_LATER',
  'VERIFICATION_SERVICE_ERROR',
  'VERIFICATION_VALIDATION_FAILED',
] as const;
export const sellerVerificationErrorCodeSchema = z.enum(sellerVerificationErrorCodeValues);
export type SellerVerificationErrorCode = z.infer<typeof sellerVerificationErrorCodeSchema>;

export const sellerVerificationStatusValues = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;
export const sellerVerificationSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string(),
  status: z.enum(sellerVerificationStatusValues),
  method: z.literal('ACCOUNT_REVIEW'),
  statement: z.string(),
  decisionReason: z.string().nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  canReapplyAt: z.string().datetime({ offset: true }).nullable(),
});
export const sellerVerificationEligibilitySchema = z.strictObject({
  eligible: z.boolean(),
  requirements: z.array(
    z.strictObject({
      key: z.enum([
        'EMAIL_VERIFIED',
        'PHONE_VERIFIED',
        'PROFILE_COMPLETE',
        'ACCOUNT_ACTIVE',
        'ACTIVITY_THRESHOLD',
      ]),
      met: z.boolean(),
      label: z.string(),
    }),
  ),
  current: sellerVerificationSchema.nullable(),
  badgeExplanation: z.string(),
});
export const sellerVerificationApplyInputSchema = z.strictObject({
  statement: z.string().trim().min(20).max(1500),
});
export const sellerVerificationDecisionSchema = z.strictObject({
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND']),
  reason: z.string().trim().min(3).max(1000),
});
export const sellerVerificationQuerySchema = z.strictObject({
  status: z.enum(sellerVerificationStatusValues).optional(),
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const sellerVerificationPageSchema = z.strictObject({
  items: z.array(sellerVerificationSchema),
});
export type SellerVerification = z.infer<typeof sellerVerificationSchema>;
export type SellerVerificationApplyInput = z.infer<typeof sellerVerificationApplyInputSchema>;
export type SellerVerificationDecision = z.infer<typeof sellerVerificationDecisionSchema>;
export type SellerVerificationEligibility = z.infer<typeof sellerVerificationEligibilitySchema>;
