import { z } from 'zod';

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
  profileImageUrl: z.string().trim().url().max(2_048).nullable().optional(),
  university: optionalNullableText(160),
  username: usernameSchema,
});

export const profileUpdateInputSchema = profileCreateInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one profile field is required.');

export type ProfileCreateInput = z.infer<typeof profileCreateInputSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;

export const publicUserProfileSchema = z.strictObject({
  bio: z.string().nullable(),
  completedSalesCount: z.number().int().nonnegative(),
  id: z.string().uuid(),
  memberSince: z.string().datetime({ offset: true }),
  profileImageUrl: z.string().url().nullable(),
  university: z.string().nullable(),
  username: usernameSchema,
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
