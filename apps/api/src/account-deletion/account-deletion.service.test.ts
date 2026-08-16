import type { AccountDeletionRequest, User } from '@thriftage/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountDeletionAuthAdmin } from './account-deletion-auth.interface';
import { AccountDeletionDomainError } from './account-deletion.errors';
import type { AccountDeletionRepository } from './account-deletion.repository';
import { AccountDeletionService } from './account-deletion.service';
import type { AuthenticatedRequestContext } from '../auth/auth.types';

const now = new Date('2026-08-16T12:00:00.000Z');
const request: AccountDeletionRequest = {
  attempts: 0,
  authIdentityDeletedAt: null,
  authProviderUserId: 'provider-user-id',
  completedAt: null,
  dataAnonymizedAt: null,
  id: '79babd7b-3f4e-40aa-a90c-9238440238d3',
  lastErrorCode: null,
  lockedAt: null,
  mediaDeletedAt: null,
  nextAttemptAt: now,
  requestedAt: now,
  sessionRevokedAt: null,
  status: 'REQUESTED',
  updatedAt: now,
  userId: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
};
const user: User = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-user-id',
  createdAt: now,
  deletedAt: null,
  email: 'user@example.com',
  emailVerified: true,
  fullName: 'User',
  id: request.userId,
  phone: '+923001234567',
  phoneVerified: true,
  role: 'USER',
  updatedAt: now,
};
const context: AuthenticatedRequestContext = {
  accessToken: 'verified-access-token',
  identity: {
    assuranceLevel: 'aal1',
    authProviderUserId: 'provider-user-id',
    email: user.email,
    issuedAt: new Date(),
    phone: user.phone,
    sessionId: 'session-id',
  },
};

describe('AccountDeletionService', () => {
  const repository = {
    findForAuthProvider: vi.fn(),
    findUserForAuthProvider: vi.fn(),
    markSessionRevoked: vi.fn(),
    request: vi.fn(),
  };
  const authAdmin: AccountDeletionAuthAdmin = {
    deleteIdentity: vi.fn(),
    revokeSession: vi.fn(),
  };
  const service = new AccountDeletionService(
    repository as unknown as AccountDeletionRepository,
    authAdmin,
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
    repository.findForAuthProvider.mockResolvedValue(null);
    repository.findUserForAuthProvider.mockResolvedValue(user);
    repository.request.mockResolvedValue(request);
    repository.markSessionRevoked.mockResolvedValue({ ...request, sessionRevokedAt: new Date() });
    vi.mocked(authAdmin.revokeSession).mockResolvedValue(undefined);
  });

  it('disables the account through a durable request and revokes the current session', async () => {
    await expect(service.request(context)).resolves.toEqual({
      completedAt: null,
      requestedAt: now.toISOString(),
      status: 'REQUESTED',
    });
    expect(repository.request).toHaveBeenCalledWith(user.id, 'provider-user-id');
    expect(authAdmin.revokeSession).toHaveBeenCalledWith('verified-access-token');
    expect(repository.markSessionRevoked).toHaveBeenCalledWith(request.id);
  });

  it('returns the existing request idempotently even after access was disabled', async () => {
    repository.findForAuthProvider.mockResolvedValue(request);
    await expect(
      service.request({
        ...context,
        identity: { ...context.identity, issuedAt: new Date(0) },
      }),
    ).resolves.toMatchObject({
      status: 'REQUESTED',
    });
    expect(repository.request).not.toHaveBeenCalled();
  });

  it('requires a recently issued provider session for a new request', async () => {
    await expect(
      service.request({
        ...context,
        identity: { ...context.identity, issuedAt: new Date(Date.now() - 601_000) },
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DELETION_REAUTH_REQUIRED' });
    expect(repository.request).not.toHaveBeenCalled();
  });

  it('returns a stable conflict when active commerce blocks deletion', async () => {
    repository.request.mockRejectedValue(
      new AccountDeletionDomainError('ACCOUNT_DELETION_ACTIVE_COMMERCE'),
    );
    await expect(service.request(context)).rejects.toMatchObject({
      code: 'ACCOUNT_DELETION_ACTIVE_COMMERCE',
    });
  });
});
