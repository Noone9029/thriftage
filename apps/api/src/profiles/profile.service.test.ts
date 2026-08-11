import { describe, expect, it, vi } from 'vitest';

import type { ProfileRepositoryContract, ProfileWithUser } from './profile.repository';
import { ProfileService } from './profile.service';

const profile = {
  bio: null,
  completedSalesCount: 0,
  createdAt: new Date('2026-08-10T00:00:00Z'),
  id: '0773a6de-b0ee-4590-8984-e736037848d4',
  profileImageKey: null,
  profileImageUrl: null,
  university: null,
  updatedAt: new Date('2026-08-11T00:00:00Z'),
  user: {
    accountStatus: 'ACTIVE',
    authProviderUserId: 'provider-id',
    createdAt: new Date('2026-08-10T00:00:00Z'),
    deletedAt: null,
    email: 'private@example.com',
    emailVerified: true,
    fullName: 'Private Name',
    id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
    phone: '+923001234567',
    phoneVerified: true,
    role: 'USER',
    updatedAt: new Date('2026-08-11T00:00:00Z'),
  },
  userId: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  username: 'safe_name',
} as ProfileWithUser;

function repository(): ProfileRepositoryContract {
  return {
    clearImage: vi.fn(),
    create: vi.fn(async () => profile),
    findActiveByUsername: vi.fn(async () => profile),
    findByUserId: vi.fn(async () => profile),
    isUsernameAvailable: vi.fn(async () => true),
    setImage: vi.fn(),
    update: vi.fn(async () => profile),
  };
}

describe('ProfileService', () => {
  it('returns a public-safe profile without account identity fields', async () => {
    const result = await new ProfileService(repository()).getPublic(' SAFE_NAME ');
    expect(result).toMatchObject({ id: profile.userId, username: 'safe_name' });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('authProviderUserId');
  });

  it('excludes the caller profile from username availability collisions', async () => {
    const repo = repository();
    await expect(
      new ProfileService(repo).availability('safe_name', profile.userId),
    ).resolves.toEqual({
      available: true,
      username: 'safe_name',
    });
    expect(repo.isUsernameAvailable).toHaveBeenCalledWith('safe_name', profile.userId);
  });

  it('does not pass forbidden owner-controlled fields to persistence', async () => {
    const repo = repository();
    await expect(
      new ProfileService(repo).update(profile.userId, { role: 'ADMIN' } as never),
    ).rejects.toMatchObject({ code: 'PROFILE_VALIDATION_FAILED' });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
