import type { Profile } from '@thriftage/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProfileImageProcessor } from './profile-image-processor';
import { ProfileImageService } from './profile-image.service';
import type { ProfileImageStorage } from './profile-image-storage.interface';
import type { ProfileRepositoryContract, ProfileWithUser } from './profile.repository';

const user = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-user',
  createdAt: new Date('2026-08-10T00:00:00Z'),
  deletedAt: null,
  email: 'private@example.com',
  emailVerified: true,
  fullName: 'Ayesha Khan',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: '+923001234567',
  phoneVerified: true,
  role: 'USER',
  updatedAt: new Date('2026-08-11T00:00:00Z'),
} as const;

function profile(profileImageKey: string | null, profileImageUrl: string | null): ProfileWithUser {
  return {
    bio: null,
    completedSalesCount: 0,
    createdAt: user.createdAt,
    id: 'b214351e-69e5-493f-b364-51b3abcb805f',
    profileImageKey,
    profileImageUrl,
    university: null,
    updatedAt: user.updatedAt,
    user,
    userId: user.id,
    username: 'ayesha_khan',
  } satisfies Profile & { user: typeof user };
}

describe('ProfileImageService', () => {
  let repository: ProfileRepositoryContract;
  let storage: ProfileImageStorage;
  let processor: ProfileImageProcessor;
  let service: ProfileImageService;

  beforeEach(() => {
    repository = {
      clearImage: vi.fn(),
      create: vi.fn(),
      findActiveByUsername: vi.fn(),
      findByUserId: vi.fn(),
      isUsernameAvailable: vi.fn(),
      setImage: vi.fn(),
      update: vi.fn(),
    };
    storage = {
      getPublicUrl: vi.fn((key: string) => `https://storage.example.com/${key}`),
      remove: vi.fn(async () => undefined),
      upload: vi.fn(async () => undefined),
    };
    processor = {
      process: vi.fn(async () => Buffer.from('safe-webp')),
    } as unknown as ProfileImageProcessor;
    service = new ProfileImageService(repository, storage, processor);
  });

  it('stores a generated WebP key, commits metadata, then cleans up the replaced object', async () => {
    vi.mocked(repository.setImage).mockImplementation(async (_userId, key, url) => ({
      previousKey: `profiles/${user.id}/old.webp`,
      profile: profile(key, url),
    }));

    const result = await service.upload(user.id, {
      buffer: Buffer.from('source'),
      mimetype: 'image/png',
      size: 6,
    });

    const key = vi.mocked(storage.upload).mock.calls[0]?.[0];
    expect(key).toMatch(new RegExp(`^profiles/${user.id}/[0-9a-f-]{36}\\.webp$`));
    expect(repository.setImage).toHaveBeenCalledWith(
      user.id,
      key,
      `https://storage.example.com/${key}`,
    );
    expect(storage.remove).toHaveBeenCalledWith(`profiles/${user.id}/old.webp`);
    expect(result.profileImageUrl).toBe(`https://storage.example.com/${key}`);
  });

  it('removes a newly uploaded object when database metadata cannot be committed', async () => {
    vi.mocked(repository.setImage).mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.upload(user.id, {
        buffer: Buffer.from('source'),
        mimetype: 'image/png',
        size: 6,
      }),
    ).rejects.toMatchObject({ code: 'PROFILE_SERVICE_ERROR' });

    const key = vi.mocked(storage.upload).mock.calls[0]?.[0];
    expect(storage.remove).toHaveBeenCalledWith(key);
  });

  it('clears authoritative metadata even when best-effort old-object cleanup is deferred', async () => {
    vi.mocked(repository.clearImage).mockResolvedValueOnce({
      previousKey: `profiles/${user.id}/old.webp`,
      profile: profile(null, null),
    });
    vi.mocked(storage.remove).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.remove(user.id)).resolves.toMatchObject({ profileImageUrl: null });
    expect(repository.clearImage).toHaveBeenCalledWith(user.id);
  });
});
