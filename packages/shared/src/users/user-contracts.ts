import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const userRoleValues = ['USER', 'ADMIN'] as const;
export const accountStatusValues = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;

export const userRoleSchema = z.enum(userRoleValues);
export const accountStatusSchema = z.enum(accountStatusValues);

export type UserRole = z.infer<typeof userRoleSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const authProviderUserIdSchema = z.string().trim().min(1).max(255);
export const emailAddressSchema = z.string().trim().toLowerCase().email().max(320);
export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must use canonical E.164 format.');

export const phoneInputSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required.')
  .max(64)
  .transform((input, context) => {
    const parsed = input.startsWith('+')
      ? parsePhoneNumberFromString(input)
      : parsePhoneNumberFromString(input, 'PK');
    if (parsed === undefined || !parsed.isValid()) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a valid phone number with country code.',
      });
      return z.NEVER;
    }
    return parsed.number;
  })
  .pipe(phoneNumberSchema);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'Username may contain lowercase letters, numbers, and underscores.');

function optionalNullableText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}

export const profileCreateInputSchema = z.strictObject({
  bio: optionalNullableText(500),
  university: optionalNullableText(160),
  username: usernameSchema,
});

export const profileUpdateInputSchema = profileCreateInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one profile field is required.');

export type ProfileCreateInput = z.infer<typeof profileCreateInputSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;

export const usernameAvailabilityQuerySchema = z.strictObject({ username: usernameSchema });
export const usernameAvailabilitySchema = z.strictObject({
  available: z.boolean(),
  username: usernameSchema,
});

export const profileErrorCodeValues = [
  'PROFILE_NOT_FOUND',
  'PROFILE_ALREADY_EXISTS',
  'USERNAME_UNAVAILABLE',
  'PROFILE_VALIDATION_FAILED',
  'PROFILE_IMAGE_INVALID',
  'PROFILE_IMAGE_TOO_LARGE',
  'PROFILE_IMAGE_STORAGE_ERROR',
  'PROFILE_SERVICE_ERROR',
] as const;

export const profileErrorCodeSchema = z.enum(profileErrorCodeValues);
export type ProfileErrorCode = z.infer<typeof profileErrorCodeSchema>;
export type UsernameAvailability = z.infer<typeof usernameAvailabilitySchema>;

export const adminAccessSchema = z.strictObject({
  authorized: z.literal(true),
  role: z.literal('ADMIN'),
});
export type AdminAccess = z.infer<typeof adminAccessSchema>;

export const publicUserProfileSchema = z.strictObject({
  bio: z.string().nullable(),
  completedSalesCount: z.number().int().nonnegative(),
  id: z.string().uuid(),
  memberSince: z.string().datetime({ offset: true }),
  profileImageUrl: z.string().url().nullable(),
  university: z.string().nullable(),
  username: usernameSchema,
});

export const privateUserProfileSchema = publicUserProfileSchema.extend({
  updatedAt: z.string().datetime({ offset: true }),
});

export const privateUserAccountSchema = z.strictObject({
  accountStatus: accountStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  email: emailAddressSchema.nullable(),
  emailVerified: z.boolean(),
  fullName: z.string().trim().min(1).max(120),
  id: z.string().uuid(),
  phone: phoneNumberSchema.nullable(),
  phoneVerified: z.boolean(),
  role: userRoleSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;
export type PrivateUserAccount = z.infer<typeof privateUserAccountSchema>;
export type PrivateUserProfile = z.infer<typeof privateUserProfileSchema>;

interface PublicUserProfileSource {
  readonly bio: string | null;
  readonly completedSalesCount: number;
  readonly profileImageUrl: string | null;
  readonly university: string | null;
  readonly user: {
    readonly createdAt: Date;
    readonly id: string;
  };
  readonly username: string;
}

interface PrivateUserAccountSource {
  readonly accountStatus: AccountStatus;
  readonly createdAt: Date;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly fullName: string;
  readonly id: string;
  readonly phone: string | null;
  readonly phoneVerified: boolean;
  readonly role: UserRole;
  readonly updatedAt: Date;
}

interface PrivateUserProfileSource extends PublicUserProfileSource {
  readonly updatedAt: Date;
}

export function serializePublicUserProfile(source: PublicUserProfileSource): PublicUserProfile {
  return publicUserProfileSchema.parse({
    bio: source.bio,
    completedSalesCount: source.completedSalesCount,
    id: source.user.id,
    memberSince: source.user.createdAt.toISOString(),
    profileImageUrl: source.profileImageUrl,
    university: source.university,
    username: source.username,
  });
}

export function serializePrivateUserAccount(source: PrivateUserAccountSource): PrivateUserAccount {
  return privateUserAccountSchema.parse({
    accountStatus: source.accountStatus,
    createdAt: source.createdAt.toISOString(),
    email: source.email,
    emailVerified: source.emailVerified,
    fullName: source.fullName,
    id: source.id,
    phone: source.phone,
    phoneVerified: source.phoneVerified,
    role: source.role,
    updatedAt: source.updatedAt.toISOString(),
  });
}

export function serializePrivateUserProfile(source: PrivateUserProfileSource): PrivateUserProfile {
  return privateUserProfileSchema.parse({
    ...serializePublicUserProfile(source),
    updatedAt: source.updatedAt.toISOString(),
  });
}
