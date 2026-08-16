import { z } from 'zod';

export const accountDeletionConfirmationInputSchema = z.strictObject({
  confirmation: z.literal('DELETE'),
});

export const accountDeletionStatusValues = [
  'REQUESTED',
  'PROCESSING',
  'RETRY',
  'COMPLETED',
  'FAILED',
] as const;

export const accountDeletionErrorCodeValues = [
  'ACCOUNT_DELETION_ACTIVE_COMMERCE',
  'ACCOUNT_DELETION_ACTIVE_DISPUTE',
  'ACCOUNT_DELETION_ADMIN_UNSUPPORTED',
  'ACCOUNT_DELETION_DISABLED',
  'ACCOUNT_DELETION_NOT_FOUND',
  'ACCOUNT_DELETION_REAUTH_REQUIRED',
  'ACCOUNT_DELETION_SERVICE_ERROR',
] as const;
export const accountDeletionErrorCodeSchema = z.enum(accountDeletionErrorCodeValues);
export type AccountDeletionErrorCode = z.infer<typeof accountDeletionErrorCodeSchema>;

export const accountDeletionStatusSchema = z.strictObject({
  completedAt: z.string().datetime({ offset: true }).nullable(),
  requestedAt: z.string().datetime({ offset: true }),
  status: z.enum(accountDeletionStatusValues),
});

export type AccountDeletionConfirmationInput = z.infer<
  typeof accountDeletionConfirmationInputSchema
>;
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>;
