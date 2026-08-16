import { z } from 'zod';

export const phoneVerificationErrorCodeValues = [
  'PHONE_INVALID',
  'PHONE_AUTH_DISABLED',
  'PHONE_ALREADY_IN_USE',
  'PHONE_VERIFICATION_NOT_FOUND',
  'PHONE_VERIFICATION_EXPIRED',
  'PHONE_VERIFICATION_CODE_INVALID',
  'PHONE_VERIFICATION_RATE_LIMITED',
  'PHONE_VERIFICATION_PROVIDER_ERROR',
  'PHONE_IDENTITY_CONFLICT',
] as const;

export const phoneVerificationErrorCodeSchema = z.enum(phoneVerificationErrorCodeValues);
export type PhoneVerificationErrorCode = z.infer<typeof phoneVerificationErrorCodeSchema>;

export const phoneVerificationAttemptStatusValues = [
  'PENDING',
  'PROVIDER_VERIFIED',
  'LINKED',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
] as const;

export const phoneVerificationAttemptStatusSchema = z.enum(phoneVerificationAttemptStatusValues);

export const phoneVerificationStartInputSchema = z.strictObject({
  phone: z.string().trim().min(1).max(64),
});

export const phoneVerificationVerifyInputSchema = z.strictObject({
  attemptId: z.string().uuid(),
  code: z.string().regex(/^\d{4,10}$/, 'Verification code must contain 4 to 10 digits.'),
});

export const phoneVerificationAttemptSchema = z.strictObject({
  attemptId: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }),
  maskedPhone: z.string().min(1).max(32),
  resendAvailableAt: z.string().datetime({ offset: true }),
  status: z.enum(['PENDING', 'PROVIDER_VERIFIED']),
});

export const phoneVerificationAlreadyLinkedSchema = z.strictObject({
  attemptId: z.null(),
  expiresAt: z.null(),
  maskedPhone: z.string().min(1).max(32),
  resendAvailableAt: z.null(),
  status: z.literal('ALREADY_VERIFIED'),
});

export const phoneVerificationChallengeSchema = z.union([
  phoneVerificationAttemptSchema,
  phoneVerificationAlreadyLinkedSchema,
]);

export type PhoneVerificationAttemptStatus = z.infer<typeof phoneVerificationAttemptStatusSchema>;
export type PhoneVerificationStartInput = z.infer<typeof phoneVerificationStartInputSchema>;
export type PhoneVerificationVerifyInput = z.infer<typeof phoneVerificationVerifyInputSchema>;
export type PhoneVerificationChallenge = z.infer<typeof phoneVerificationChallengeSchema>;
