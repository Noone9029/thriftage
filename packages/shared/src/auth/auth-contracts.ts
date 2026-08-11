import { z } from 'zod';

export const provisionUserInputSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
});

export type ProvisionUserInput = z.infer<typeof provisionUserInputSchema>;

export const mobilePasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.');

export const mobileLoginInputSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1, 'Password is required.'),
});

export const mobileSignupInputSchema = z
  .strictObject({
    confirmPassword: z.string(),
    email: z.string().trim().toLowerCase().email().max(320),
    fullName: z.string().trim().min(1).max(120),
    password: mobilePasswordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const mobileForgotPasswordInputSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const mobileResetPasswordInputSchema = z
  .strictObject({
    confirmPassword: z.string(),
    password: mobilePasswordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type MobileLoginInput = z.infer<typeof mobileLoginInputSchema>;
export type MobileSignupInput = z.infer<typeof mobileSignupInputSchema>;
export type MobileForgotPasswordInput = z.infer<typeof mobileForgotPasswordInputSchema>;
export type MobileResetPasswordInput = z.infer<typeof mobileResetPasswordInputSchema>;

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
