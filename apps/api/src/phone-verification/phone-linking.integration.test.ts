import { randomUUID } from 'node:crypto';

import { createPrismaClient, type Prisma, type PrismaClient, type User } from '@thriftage/db';
import { serializePublicUserProfile } from '@thriftage/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthAdminProviderError,
  type AuthAdminProvider,
  type AuthAdminUser,
} from './auth-admin-provider.interface';
import { PhoneLinkingService, type PhoneVerificationPolicy } from './phone-linking.service';
import {
  PhoneVerificationProviderError,
  type PhoneVerificationCheckResult,
  type PhoneVerificationProvider,
} from './phone-verification-provider.interface';
import { PhoneVerificationRepository } from './phone-verification.repository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) {
  throw new Error('TEST_DATABASE_URL is required for phone linking integration tests.');
}

const prisma = createPrismaClient(testDatabaseUrl);
const policy: PhoneVerificationPolicy = {
  attemptTtlSeconds: 600,
  maxChecks: 5,
  maxSends: 3,
  maxStarts: 5,
  resendCooldownSeconds: 60,
  startWindowSeconds: 3_600,
};

class DeterministicVerificationProvider implements PhoneVerificationProvider {
  public checkResult: PhoneVerificationCheckResult = { status: 'APPROVED' };
  public sendError: PhoneVerificationProviderError | null = null;
  public readonly checked: Array<{ code: string; phone: string }> = [];
  public readonly sent: string[] = [];

  public async sendVerification(phone: string) {
    if (this.sendError !== null) throw this.sendError;
    this.sent.push(phone);
    return { providerReference: `VE-${this.sent.length}`, status: 'PENDING' as const };
  }

  public async verifyCode(phone: string, code: string) {
    this.checked.push({ code, phone });
    return this.checkResult;
  }
}

class DeterministicAuthAdminProvider implements AuthAdminProvider {
  public readonly users = new Map<string, AuthAdminUser>();
  public readonly updates: Array<{ authProviderUserId: string; phone: string }> = [];

  public async getUserById(authProviderUserId: string): Promise<AuthAdminUser> {
    const user = this.users.get(authProviderUserId);
    if (user === undefined) throw new AuthAdminProviderError('PROVIDER_ERROR');
    return user;
  }

  public async setVerifiedPhone(authProviderUserId: string, phone: string): Promise<AuthAdminUser> {
    const existing = this.users.get(authProviderUserId);
    if (existing === undefined) throw new AuthAdminProviderError('PROVIDER_ERROR');
    if (
      [...this.users.values()].some(
        (candidate) =>
          candidate.authProviderUserId !== authProviderUserId && candidate.phone === phone,
      )
    ) {
      throw new AuthAdminProviderError('PROVIDER_ERROR');
    }
    const updated = { authProviderUserId, phone, phoneVerified: true };
    this.users.set(authProviderUserId, updated);
    this.updates.push({ authProviderUserId, phone });
    return updated;
  }
}

function createUserData(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  const id = randomUUID();
  return {
    authProviderUserId: `provider-${id}`,
    email: `${id}@example.com`,
    emailVerified: true,
    fullName: 'Phone Test User',
    ...overrides,
  };
}

async function clearTables(client: PrismaClient): Promise<void> {
  await client.phoneVerificationAttempt.deleteMany();
  await client.profile.deleteMany();
  await client.user.deleteMany();
}

describe.sequential('PhoneLinkingService PostgreSQL integration', () => {
  let now: Date;
  let verificationProvider: DeterministicVerificationProvider;
  let authAdminProvider: DeterministicAuthAdminProvider;
  let repository: PhoneVerificationRepository;
  let service: PhoneLinkingService;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(() => {
    now = new Date('2026-08-11T00:00:00.000Z');
    verificationProvider = new DeterministicVerificationProvider();
    authAdminProvider = new DeterministicAuthAdminProvider();
    repository = new PhoneVerificationRepository(prisma);
    service = new PhoneLinkingService(
      verificationProvider,
      authAdminProvider,
      repository,
      policy,
      () => now,
    );
  });

  afterEach(async () => {
    await clearTables(prisma);
  });

  afterAll(async () => {
    await clearTables(prisma);
    await prisma.$disconnect();
  });

  async function createUser(overrides: Partial<Prisma.UserCreateInput> = {}): Promise<User> {
    const user = await prisma.user.create({ data: createUserData(overrides) });
    authAdminProvider.users.set(user.authProviderUserId, {
      authProviderUserId: user.authProviderUserId,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
    });
    return user;
  }

  it('creates an owned pending attempt without storing an OTP', async () => {
    const user = await createUser();
    const result = await service.start(user, { phone: '+92 300 1234567' });
    const stored = await prisma.phoneVerificationAttempt.findUnique({
      where: { id: result.attemptId ?? '' },
    });

    expect(stored).toMatchObject({
      phone: '+923001234567',
      providerReference: 'VE-1',
      status: 'PENDING',
      userId: user.id,
    });
    expect(Object.keys(stored ?? {})).not.toContain('code');
  });

  it('supersedes an old pending attempt and leaves only one actionable challenge', async () => {
    const user = await createUser();
    const first = await service.start(user, { phone: '+923001234567' });
    const second = await service.start(user, { phone: '+14155552671' });

    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: first.attemptId ?? '' } }),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: second.attemptId ?? '' } }),
    ).resolves.toMatchObject({ status: 'PENDING' });
    await expect(
      prisma.phoneVerificationAttempt.count({ where: { status: 'PENDING', userId: user.id } }),
    ).resolves.toBe(1);
  });

  it('serializes concurrent starts and retains one pending attempt', async () => {
    const user = await createUser();
    const results = await Promise.allSettled([
      service.start(user, { phone: '+923001234567' }),
      service.start(user, { phone: '+14155552671' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(
      prisma.phoneVerificationAttempt.count({ where: { status: 'PENDING', userId: user.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.phoneVerificationAttempt.count({ where: { status: 'CANCELLED', userId: user.id } }),
    ).resolves.toBe(1);
  });

  it('blocks a phone already owned by another application user', async () => {
    await createUser({ phone: '+923001234567', phoneVerified: true });
    const requester = await createUser();

    await expect(service.start(requester, { phone: '+92 300 1234567' })).rejects.toMatchObject({
      code: 'PHONE_ALREADY_IN_USE',
    });
    expect(verificationProvider.sent).toHaveLength(0);
  });

  it('does not allow User B to verify User A attempt', async () => {
    const first = await createUser();
    const second = await createUser();
    const attempt = await service.start(first, { phone: '+923001234567' });

    await expect(
      service.verify(second, { attemptId: attempt.attemptId ?? '', code: '012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_NOT_FOUND' });
    expect(verificationProvider.checked).toHaveLength(0);
  });

  it('enforces resend cooldowns and persisted send limits', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });

    await expect(service.resend(user, attempt.attemptId ?? '')).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_RATE_LIMITED',
    });
    now = new Date('2026-08-11T00:01:01.000Z');
    await service.resend(user, attempt.attemptId ?? '');
    now = new Date('2026-08-11T00:02:02.000Z');
    await service.resend(user, attempt.attemptId ?? '');
    now = new Date('2026-08-11T00:03:03.000Z');
    await expect(service.resend(user, attempt.attemptId ?? '')).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_RATE_LIMITED',
    });

    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: attempt.attemptId ?? '' } }),
    ).resolves.toMatchObject({ sendCount: 3 });
    expect(verificationProvider.sent).toHaveLength(3);
  });

  it('limits repeated invalid code checks without persisting submitted codes', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    verificationProvider.checkResult = { status: 'INVALID' };

    for (let check = 0; check < policy.maxChecks; check += 1) {
      await expect(
        service.verify(user, { attemptId: attempt.attemptId ?? '', code: `00000${check}` }),
      ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_CODE_INVALID' });
    }
    await expect(
      service.verify(user, { attemptId: attempt.attemptId ?? '', code: '999999' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_RATE_LIMITED' });

    const stored = await prisma.phoneVerificationAttempt.findUnique({
      where: { id: attempt.attemptId ?? '' },
    });
    expect(stored).toMatchObject({ verificationCheckCount: policy.maxChecks });
    expect(JSON.stringify(stored)).not.toContain('00000');
  });

  it('returns the current masked attempt and cancels only pending workflow state', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });

    await expect(service.current(user)).resolves.toMatchObject({
      attemptId: attempt.attemptId,
      maskedPhone: '+92******4567',
      status: 'PENDING',
    });
    await service.cancel(user);
    await expect(service.current(user)).resolves.toBeNull();
    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: attempt.attemptId ?? '' } }),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      phone: null,
      phoneVerified: false,
    });
  });

  it('limits one user from rapidly starting challenges for many phone values', async () => {
    const user = await createUser();
    for (let start = 0; start < policy.maxStarts; start += 1) {
      await service.start(user, { phone: '+923001234567' });
    }

    await expect(service.start(user, { phone: '+14155552671' })).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_RATE_LIMITED',
    });
    expect(verificationProvider.sent).toHaveLength(policy.maxStarts);
  });

  it('rejects an incorrect code without changing either identity', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    verificationProvider.checkResult = { status: 'INVALID' };

    await expect(
      service.verify(user, { attemptId: attempt.attemptId ?? '', code: '000000' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_CODE_INVALID' });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      phone: null,
      phoneVerified: false,
    });
    expect(authAdminProvider.updates).toHaveLength(0);
  });

  it('links an approved phone to the same existing application and auth users', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    const linked = await service.verify(user, {
      attemptId: attempt.attemptId ?? '',
      code: '012345',
    });

    expect(linked).toMatchObject({
      authProviderUserId: user.authProviderUserId,
      id: user.id,
      phone: '+923001234567',
      phoneVerified: true,
    });
    expect(authAdminProvider.updates).toEqual([
      { authProviderUserId: user.authProviderUserId, phone: '+923001234567' },
    ]);
    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: attempt.attemptId ?? '' } }),
    ).resolves.toMatchObject({ status: 'LINKED' });
  });

  it('keeps phone data out of the public profile after linking', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: { userId: user.id, username: `user_${randomUUID().slice(0, 8)}` },
    });
    const attempt = await service.start(user, { phone: '+923001234567' });
    await service.verify(user, { attemptId: attempt.attemptId ?? '', code: '012345' });
    const profile = await prisma.profile.findUniqueOrThrow({
      include: { user: true },
      where: { userId: user.id },
    });
    const serialized = serializePublicUserProfile(profile);

    expect(serialized).not.toHaveProperty('phone');
    expect(serialized).not.toHaveProperty('phoneVerified');
    expect(serialized).not.toHaveProperty('authProviderUserId');
  });

  it('returns a repeated verify idempotently without another provider call', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    await service.verify(user, { attemptId: attempt.attemptId ?? '', code: '012345' });
    await service.verify(user, { attemptId: attempt.attemptId ?? '', code: '999999' });

    expect(verificationProvider.checked).toHaveLength(1);
    expect(authAdminProvider.updates).toHaveLength(1);
  });

  it('reconciles after external success and a simulated prior database failure', async () => {
    const user = await createUser();
    const attempt = await prisma.phoneVerificationAttempt.create({
      data: {
        createdAt: now,
        expiresAt: new Date('2026-08-11T00:10:00.000Z'),
        phone: '+923001234567',
        providerVerifiedAt: now,
        resendAvailableAt: new Date('2026-08-11T00:01:00.000Z'),
        status: 'PROVIDER_VERIFIED',
        userId: user.id,
      },
    });
    authAdminProvider.users.set(user.authProviderUserId, {
      authProviderUserId: user.authProviderUserId,
      phone: attempt.phone,
      phoneVerified: true,
    });

    const reconciled = await service.verify(user, { attemptId: attempt.id, code: '012345' });

    expect(reconciled).toMatchObject({ phone: attempt.phone, phoneVerified: true });
    expect(verificationProvider.checked).toHaveLength(0);
    expect(authAdminProvider.updates).toHaveLength(0);
  });

  it('fails closed on a Supabase identity mismatch', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    authAdminProvider.users.set(user.authProviderUserId, {
      authProviderUserId: 'different-provider-user',
      phone: null,
      phoneVerified: false,
    });

    await expect(
      service.verify(user, { attemptId: attempt.attemptId ?? '', code: '012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_IDENTITY_CONFLICT' });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      phoneVerified: false,
    });
    expect(authAdminProvider.updates).toHaveLength(0);
  });

  it.each([
    ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
    ['DEACTIVATED', 'ACCOUNT_DEACTIVATED'],
  ] as const)('does not complete linking after the account becomes %s', async (status, code) => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    await prisma.user.update({ data: { accountStatus: status }, where: { id: user.id } });

    await expect(
      service.verify(user, { attemptId: attempt.attemptId ?? '', code: '012345' }),
    ).rejects.toMatchObject({ code });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      phoneVerified: false,
    });
    expect(authAdminProvider.updates).toHaveLength(0);
  });

  it('expires stale attempts before calling the provider', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    now = new Date('2026-08-11T00:11:00.000Z');

    await expect(
      service.verify(user, { attemptId: attempt.attemptId ?? '', code: '012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_EXPIRED' });
    expect(verificationProvider.checked).toHaveLength(0);
    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: attempt.attemptId ?? '' } }),
    ).resolves.toMatchObject({ status: 'EXPIRED' });
  });

  it('persists expiration reported by the verification provider', async () => {
    const user = await createUser();
    const attempt = await service.start(user, { phone: '+923001234567' });
    verificationProvider.verifyCode = async () => {
      throw new PhoneVerificationProviderError('EXPIRED');
    };

    await expect(
      service.verify(user, { attemptId: attempt.attemptId ?? '', code: '012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_EXPIRED' });
    await expect(
      prisma.phoneVerificationAttempt.findUnique({ where: { id: attempt.attemptId ?? '' } }),
    ).resolves.toMatchObject({ status: 'EXPIRED' });
  });

  it('does not falsely verify a phone when challenge sending fails', async () => {
    const user = await createUser();
    verificationProvider.sendError = new PhoneVerificationProviderError('PROVIDER_ERROR');

    await expect(service.start(user, { phone: '+923001234567' })).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_PROVIDER_ERROR',
    });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      phone: null,
      phoneVerified: false,
    });
    await expect(
      prisma.phoneVerificationAttempt.findFirst({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ status: 'FAILED' });
  });

  it('database uniqueness prevents concurrent final ownership of one phone', async () => {
    const first = await createUser();
    const second = await createUser();
    const attempts = await Promise.all(
      [first, second].map((owner) =>
        prisma.phoneVerificationAttempt.create({
          data: {
            createdAt: now,
            expiresAt: new Date('2026-08-11T00:10:00.000Z'),
            phone: '+923001234567',
            providerVerifiedAt: now,
            resendAvailableAt: new Date('2026-08-11T00:01:00.000Z'),
            status: 'PROVIDER_VERIFIED',
            userId: owner.id,
          },
        }),
      ),
    );

    const results = await Promise.allSettled([
      repository.completeLink(first.id, attempts[0]!.id, '+923001234567', now),
      repository.completeLink(second.id, attempts[1]!.id, '+923001234567', now),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(
      prisma.user.count({ where: { phone: '+923001234567', phoneVerified: true } }),
    ).resolves.toBe(1);
  });
});
