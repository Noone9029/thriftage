import type { PhoneVerificationAttempt, User } from '@thriftage/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthAdminProvider } from './auth-admin-provider.interface';
import { PhoneLinkingService, type PhoneVerificationPolicy } from './phone-linking.service';
import type { PhoneVerificationProvider } from './phone-verification-provider.interface';
import type { PhoneVerificationRepositoryContract } from './phone-verification.repository';

const now = new Date('2026-08-11T00:00:00.000Z');
const user: User = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-user-id',
  createdAt: now,
  deletedAt: null,
  email: 'user@example.com',
  emailVerified: true,
  fullName: 'Test User',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: null,
  phoneVerified: false,
  role: 'USER',
  updatedAt: now,
};

const pendingAttempt: PhoneVerificationAttempt = {
  cancelledAt: null,
  createdAt: now,
  expiresAt: new Date('2026-08-11T00:10:00.000Z'),
  failedAt: null,
  id: '0b72b4ca-71f6-4c99-bac3-7a3efc455271',
  linkedAt: null,
  phone: '+923001234567',
  provider: 'TWILIO_VERIFY',
  providerReference: null,
  providerVerifiedAt: null,
  resendAvailableAt: new Date('2026-08-11T00:01:00.000Z'),
  sendCount: 1,
  status: 'PENDING',
  updatedAt: now,
  userId: user.id,
  verificationCheckCount: 0,
};

const policy: PhoneVerificationPolicy = {
  attemptTtlSeconds: 600,
  maxChecks: 5,
  maxSends: 5,
  maxStarts: 5,
  resendCooldownSeconds: 60,
  startWindowSeconds: 3_600,
};

describe('PhoneLinkingService', () => {
  let provider: PhoneVerificationProvider;
  let authAdmin: AuthAdminProvider;
  let repository: PhoneVerificationRepositoryContract;
  let service: PhoneLinkingService;

  beforeEach(() => {
    provider = {
      sendVerification: vi.fn().mockResolvedValue({
        providerReference: 'VE-safe-reference',
        status: 'PENDING',
      }),
      verifyCode: vi.fn().mockResolvedValue({ status: 'APPROVED' }),
    };
    authAdmin = {
      getUserById: vi.fn().mockResolvedValue({
        authProviderUserId: user.authProviderUserId,
        phone: null,
        phoneVerified: false,
      }),
      setVerifiedPhone: vi.fn().mockResolvedValue({
        authProviderUserId: user.authProviderUserId,
        phone: pendingAttempt.phone,
        phoneVerified: true,
      }),
    };
    repository = {
      cancelCurrent: vi.fn().mockResolvedValue(undefined),
      completeLink: vi.fn().mockResolvedValue({
        ...user,
        phone: pendingAttempt.phone,
        phoneVerified: true,
      }),
      createAttempt: vi.fn().mockResolvedValue(pendingAttempt),
      findCurrent: vi.fn().mockResolvedValue(pendingAttempt),
      findOwned: vi.fn().mockResolvedValue({
        ...pendingAttempt,
        providerReference: 'VE-safe-reference',
      }),
      findUserById: vi.fn().mockResolvedValue(user),
      findUserByPhone: vi.fn().mockResolvedValue(null),
      markExpired: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      markProviderSent: vi.fn().mockResolvedValue(undefined),
      markProviderVerified: vi.fn().mockResolvedValue({
        ...pendingAttempt,
        providerVerifiedAt: now,
        status: 'PROVIDER_VERIFIED',
      }),
      reserveCheck: vi.fn().mockResolvedValue(pendingAttempt),
      reserveResend: vi.fn().mockResolvedValue(pendingAttempt),
    };
    service = new PhoneLinkingService(provider, authAdmin, repository, policy, () => now);
  });

  it('normalizes, sends, and returns only masked challenge data', async () => {
    const result = await service.start(user, { phone: '+92 300 1234567' });

    expect(provider.sendVerification).toHaveBeenCalledWith('+923001234567');
    expect(repository.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+923001234567', userId: user.id }),
    );
    expect(result).toMatchObject({
      attemptId: pendingAttempt.id,
      maskedPhone: '+92******4567',
      status: 'PENDING',
    });
    expect(JSON.stringify(result)).not.toContain(pendingAttempt.phone);
  });

  it('returns idempotent success when the same phone is already verified', async () => {
    const result = await service.start(
      { ...user, phone: pendingAttempt.phone, phoneVerified: true },
      { phone: '+92 300 1234567' },
    );

    expect(result.status).toBe('ALREADY_VERIFIED');
    expect(provider.sendVerification).not.toHaveBeenCalled();
  });

  it('blocks replacing an already verified different phone', async () => {
    await expect(
      service.start(
        { ...user, phone: '+14155552671', phoneVerified: true },
        { phone: pendingAttempt.phone },
      ),
    ).rejects.toMatchObject({ code: 'PHONE_IDENTITY_CONFLICT' });
  });

  it('persists provider approval before updating the exact Supabase identity', async () => {
    await expect(
      service.verify(user, { attemptId: pendingAttempt.id, code: '012345' }),
    ).resolves.toMatchObject({ phone: pendingAttempt.phone, phoneVerified: true });

    expect(repository.markProviderVerified).toHaveBeenCalledBefore(
      vi.mocked(authAdmin.setVerifiedPhone),
    );
    expect(authAdmin.getUserById).toHaveBeenCalledWith(user.authProviderUserId);
    expect(authAdmin.setVerifiedPhone).toHaveBeenCalledWith(
      user.authProviderUserId,
      pendingAttempt.phone,
    );
    expect(repository.completeLink).toHaveBeenCalledWith(
      user.id,
      pendingAttempt.id,
      pendingAttempt.phone,
      now,
    );
  });

  it('reconciles a provider-verified retry when Supabase already has the expected phone', async () => {
    vi.mocked(repository.reserveCheck).mockResolvedValue({
      ...pendingAttempt,
      providerVerifiedAt: now,
      status: 'PROVIDER_VERIFIED',
    });
    vi.mocked(authAdmin.getUserById).mockResolvedValue({
      authProviderUserId: user.authProviderUserId,
      phone: pendingAttempt.phone,
      phoneVerified: true,
    });

    await service.verify(user, { attemptId: pendingAttempt.id, code: '012345' });

    expect(provider.verifyCode).not.toHaveBeenCalled();
    expect(authAdmin.setVerifiedPhone).not.toHaveBeenCalled();
    expect(repository.completeLink).toHaveBeenCalledOnce();
  });

  it('fails closed when the auth identity has a different phone', async () => {
    vi.mocked(authAdmin.getUserById).mockResolvedValue({
      authProviderUserId: user.authProviderUserId,
      phone: '+14155552671',
      phoneVerified: true,
    });

    await expect(
      service.verify(user, { attemptId: pendingAttempt.id, code: '012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_IDENTITY_CONFLICT' });
    expect(authAdmin.setVerifiedPhone).not.toHaveBeenCalled();
    expect(repository.completeLink).not.toHaveBeenCalled();
  });

  it('fails closed when auth reports confirmation without the expected phone', async () => {
    vi.mocked(authAdmin.getUserById).mockResolvedValue({
      authProviderUserId: user.authProviderUserId,
      phone: null,
      phoneVerified: true,
    });

    await expect(
      service.verify(user, { attemptId: pendingAttempt.id, code: '012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_IDENTITY_CONFLICT' });
    expect(repository.completeLink).not.toHaveBeenCalled();
  });

  it('does not update either identity when the provider rejects the OTP', async () => {
    vi.mocked(provider.verifyCode).mockResolvedValue({ status: 'INVALID' });

    await expect(
      service.verify(user, { attemptId: pendingAttempt.id, code: '000000' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_CODE_INVALID' });
    expect(authAdmin.setVerifiedPhone).not.toHaveBeenCalled();
    expect(repository.completeLink).not.toHaveBeenCalled();
  });

  it('returns an already linked attempt without another external request', async () => {
    vi.mocked(repository.reserveCheck).mockResolvedValue({
      ...pendingAttempt,
      linkedAt: now,
      providerVerifiedAt: now,
      status: 'LINKED',
    });
    vi.mocked(repository.findUserById).mockResolvedValue({
      ...user,
      phone: pendingAttempt.phone,
      phoneVerified: true,
    });

    await expect(
      service.verify(user, { attemptId: pendingAttempt.id, code: '012345' }),
    ).resolves.toMatchObject({ phoneVerified: true });
    expect(provider.verifyCode).not.toHaveBeenCalled();
    expect(authAdmin.getUserById).not.toHaveBeenCalled();
  });
});
