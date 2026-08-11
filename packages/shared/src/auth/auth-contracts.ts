import { z } from 'zod';

export const provisionUserInputSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
});

export type ProvisionUserInput = z.infer<typeof provisionUserInputSchema>;

export const authErrorCodeValues = [
  'AUTH_REQUIRED',
  'AUTH_INVALID_TOKEN',
  'AUTH_EXPIRED_TOKEN',
  'AUTH_USER_NOT_PROVISIONED',
  'AUTH_IDENTITY_CONFLICT',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DEACTIVATED',
] as const;

export const authErrorCodeSchema = z.enum(authErrorCodeValues);
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;
