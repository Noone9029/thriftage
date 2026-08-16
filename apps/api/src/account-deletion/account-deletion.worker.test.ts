import type { AccountDeletionRequest } from '@thriftage/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountDeletionAuthAdmin } from './account-deletion-auth.interface';
import type { AccountDeletionRepository } from './account-deletion.repository';
import { AccountDeletionWorker } from './account-deletion.worker';
import type { ListingImageStorage } from '../listing-media/listing-image-storage.interface';
import type { ProfileImageStorage } from '../profiles/profile-image-storage.interface';

const now = new Date('2026-08-16T12:00:00.000Z');
const request: AccountDeletionRequest = {
  attempts: 1,
  authIdentityDeletedAt: null,
  authProviderUserId: 'provider-user-id',
  completedAt: null,
  dataAnonymizedAt: null,
  id: '79babd7b-3f4e-40aa-a90c-9238440238d3',
  lastErrorCode: null,
  lockedAt: now,
  mediaDeletedAt: null,
  nextAttemptAt: now,
  requestedAt: now,
  sessionRevokedAt: now,
  status: 'PROCESSING',
  updatedAt: now,
  userId: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
};

describe('AccountDeletionWorker', () => {
  const repository = {
    anonymizeApplicationData: vi.fn(),
    claim: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    getMedia: vi.fn(),
    markAuthIdentityDeleted: vi.fn(),
    markMediaDeleted: vi.fn(),
  };
  const authAdmin: AccountDeletionAuthAdmin = {
    deleteIdentity: vi.fn(),
    revokeSession: vi.fn(),
  };
  const profileStorage: ProfileImageStorage = {
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
  };
  const listingStorage: ListingImageStorage = {
    createSignedUrls: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
  };
  const worker = new AccountDeletionWorker(
    repository as unknown as AccountDeletionRepository,
    authAdmin,
    profileStorage,
    listingStorage,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ACCOUNT_DELETION_ENABLED', 'true');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-placeholder');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-placeholder');
    vi.stubEnv('SUPABASE_URL', 'https://project-ref.supabase.co');
    vi.stubEnv('TWILIO_ACCOUNT_SID', `AC${'1'.repeat(32)}`);
    vi.stubEnv('TWILIO_API_KEY_SECRET', 'test-api-key-secret-placeholder');
    vi.stubEnv('TWILIO_API_KEY_SID', `SK${'2'.repeat(32)}`);
    vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', `VA${'3'.repeat(32)}`);
    repository.claim.mockResolvedValue([request]);
    repository.getMedia.mockResolvedValue({
      listingImageKeys: ['listings/user/one.webp', 'listings/user/two.webp'],
      profileImageKey: 'profiles/user/avatar.webp',
    });
    repository.markMediaDeleted.mockResolvedValue({ ...request, mediaDeletedAt: now });
    repository.anonymizeApplicationData.mockResolvedValue(undefined);
    repository.markAuthIdentityDeleted.mockResolvedValue({
      ...request,
      authIdentityDeletedAt: now,
    });
    repository.complete.mockResolvedValue({ ...request, completedAt: now, status: 'COMPLETED' });
    vi.mocked(profileStorage.remove).mockResolvedValue(undefined);
    vi.mocked(listingStorage.remove).mockResolvedValue(undefined);
    vi.mocked(authAdmin.deleteIdentity).mockResolvedValue(undefined);
  });

  it('executes resumable cleanup steps and deletes the auth identity last', async () => {
    await worker.tick();
    expect(profileStorage.remove).toHaveBeenCalledWith('profiles/user/avatar.webp');
    expect(listingStorage.remove).toHaveBeenCalledWith([
      'listings/user/one.webp',
      'listings/user/two.webp',
    ]);
    expect(repository.anonymizeApplicationData).toHaveBeenCalledWith(request);
    expect(authAdmin.deleteIdentity).toHaveBeenCalledWith('provider-user-id');
    expect(repository.complete).toHaveBeenCalledWith(request.id);
    expect(vi.mocked(repository.anonymizeApplicationData).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(authAdmin.deleteIdentity).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('skips already completed steps after a worker restart', async () => {
    repository.claim.mockResolvedValue([
      { ...request, dataAnonymizedAt: now, mediaDeletedAt: now },
    ]);
    await worker.tick();
    expect(profileStorage.remove).not.toHaveBeenCalled();
    expect(listingStorage.remove).not.toHaveBeenCalled();
    expect(repository.anonymizeApplicationData).not.toHaveBeenCalled();
    expect(authAdmin.deleteIdentity).toHaveBeenCalledTimes(1);
  });

  it('records a bounded retry without leaking provider details', async () => {
    vi.mocked(authAdmin.deleteIdentity).mockRejectedValue(new Error('provider details'));
    await worker.tick();
    expect(repository.fail).toHaveBeenCalledWith(request, 'ACCOUNT_DELETION_STEP_FAILED', 10);
    expect(repository.complete).not.toHaveBeenCalled();
  });
});
