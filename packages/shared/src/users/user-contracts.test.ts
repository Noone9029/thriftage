import { describe, expect, it } from 'vitest';

import {
  accountStatusSchema,
  privateUserAccountSchema,
  privateUserProfileSchema,
  profileCreateInputSchema,
  profileUpdateInputSchema,
  serializePrivateUserAccount,
  serializePublicUserProfile,
  userRoleSchema,
  usernameAvailabilityQuerySchema,
} from './user-contracts';

const privateSource = {
  accountStatus: 'ACTIVE' as const,
  authProviderUserId: 'supabase-user-id',
  createdAt: new Date('2026-08-10T00:00:00.000Z'),
  deletedAt: null,
  email: 'owner@example.com',
  emailVerified: true,
  fullName: 'Private Name',
  id: '7abecda8-4ee3-4d55-a220-f9f473510de8',
  phone: '+923001234567',
  phoneVerified: false,
  role: 'USER' as const,
  updatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

const publicSource = {
  bio: 'Curating timeless pieces.',
  completedSalesCount: 4,
  profileImageUrl: 'https://cdn.example.com/profile.jpg',
  university: 'Example University',
  user: privateSource,
  userId: privateSource.id,
  username: 'private_name',
};

describe('user contracts', () => {
  it('defines the bounded initial authorization and account states', () => {
    expect(userRoleSchema.options).toEqual(['USER', 'ADMIN']);
    expect(accountStatusSchema.options).toEqual(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']);
  });

  it.each(['email', 'phone', 'authProviderUserId', 'accountStatus'])(
    'never exposes %s in a public profile',
    (forbiddenField) => {
      const result = serializePublicUserProfile(publicSource);

      expect(result).not.toHaveProperty(forbiddenField);
      expect(result).not.toHaveProperty(`user.${forbiddenField}`);
    },
  );

  it('keeps authentication-provider and deletion metadata out of the owner account contract', () => {
    const result = serializePrivateUserAccount(privateSource);

    expect(privateUserAccountSchema.parse(result)).toEqual(result);
    expect(result).not.toHaveProperty('authProviderUserId');
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('normalizes profile creation fields at the contract boundary', () => {
    expect(
      profileCreateInputSchema.parse({
        bio: '  A careful closet edit.  ',
        university: '  Example University  ',
        username: '  Style_User  ',
      }),
    ).toEqual({
      bio: 'A careful closet edit.',
      university: 'Example University',
      username: 'style_user',
    });
  });

  it('rejects caller-controlled profile image URLs', () => {
    expect(
      profileCreateInputSchema.safeParse({
        profileImageUrl: 'https://attacker.example/avatar.png',
        username: 'safe_name',
      }).success,
    ).toBe(false);
  });

  it('normalizes username availability queries', () => {
    expect(usernameAvailabilityQuerySchema.parse({ username: ' Ayesha_1 ' })).toEqual({
      username: 'ayesha_1',
    });
  });

  it('keeps private profile output free of private account identity', () => {
    const result = privateUserProfileSchema.parse({
      bio: null,
      completedSalesCount: 0,
      id: privateSource.id,
      memberSince: '2026-08-10T00:00:00.000Z',
      profileImageUrl: null,
      university: null,
      updatedAt: '2026-08-10T00:00:00.000Z',
      username: 'safe_name',
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('authProviderUserId');
  });

  it.each(['completedSalesCount', 'role', 'accountStatus'])(
    'rejects owner-controlled %s profile updates',
    (field) => {
      expect(() =>
        profileUpdateInputSchema.parse({
          [field]: field === 'completedSalesCount' ? 99 : 'ADMIN',
        }),
      ).toThrow();
    },
  );
});
