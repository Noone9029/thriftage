import { randomUUID } from 'node:crypto';

import { getPrismaClient } from '@thriftage/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { AuthoritativeAuthUserProvider } from './auth-provider.interface';
import type {
  AuthenticatedIdentity,
  AuthenticatedRequestContext,
  AuthoritativeAuthUser,
} from './auth.types';
import { ProvisionUserService } from './provision-user.service';

class DeterministicAuthUserProvider implements AuthoritativeAuthUserProvider {
  public user: AuthoritativeAuthUser = {
    authProviderUserId: 'unset',
    email: null,
    emailVerified: false,
    phone: null,
    phoneVerified: false,
  };

  public async getUser(): Promise<AuthoritativeAuthUser> {
    return this.user;
  }
}

const prisma = getPrismaClient();
const provider = new DeterministicAuthUserProvider();
const service = new ProvisionUserService(provider);

function identityContext(authProviderUserId: string): AuthenticatedRequestContext {
  const identity: AuthenticatedIdentity = {
    assuranceLevel: 'aal1',
    authProviderUserId,
    email: null,
    phone: null,
    sessionId: randomUUID(),
  };
  return { accessToken: `test-token-${randomUUID()}`, identity };
}

function authoritativeUser(
  authProviderUserId: string,
  overrides: Partial<AuthoritativeAuthUser> = {},
): AuthoritativeAuthUser {
  const suffix = randomUUID().replaceAll('-', '').replace(/[a-f]/g, '1').slice(0, 10);
  return {
    authProviderUserId,
    email: `${randomUUID()}@example.com`,
    emailVerified: true,
    phone: `+92${suffix}`,
    phoneVerified: true,
    ...overrides,
  };
}

describe.sequential('ProvisionUserService database invariants', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('creates one default USER linked only to authoritative provider data', async () => {
    const subject = randomUUID();
    const context = identityContext(subject);
    provider.user = authoritativeUser(subject);

    const user = await service.provision(context, { fullName: '  First User  ' });

    expect(user).toMatchObject({
      accountStatus: 'ACTIVE',
      authProviderUserId: subject,
      email: provider.user.email,
      emailVerified: true,
      fullName: 'First User',
      phone: provider.user.phone,
      phoneVerified: true,
      role: 'USER',
    });
    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.profile.count()).resolves.toBe(0);
  });

  it('returns the existing user without overwriting application state', async () => {
    const subject = randomUUID();
    const context = identityContext(subject);
    provider.user = authoritativeUser(subject);
    const first = await service.provision(context, { fullName: 'Original Name' });
    await prisma.user.update({
      data: { accountStatus: 'SUSPENDED', fullName: 'Persisted Name', role: 'ADMIN' },
      where: { id: first.id },
    });

    const repeated = await service.provision(context, { fullName: 'Replacement Name' });

    expect(repeated).toMatchObject({
      accountStatus: 'SUSPENDED',
      fullName: 'Persisted Name',
      id: first.id,
      role: 'ADMIN',
    });
    await expect(prisma.user.count()).resolves.toBe(1);
  });

  it('handles concurrent provisioning without duplicate users', async () => {
    const subject = randomUUID();
    const context = identityContext(subject);
    provider.user = authoritativeUser(subject);

    const users = await Promise.all(
      Array.from({ length: 8 }, () => service.provision(context, { fullName: 'Concurrent User' })),
    );

    expect(new Set(users.map((user) => user.id))).toHaveLength(1);
    await expect(prisma.user.count({ where: { authProviderUserId: subject } })).resolves.toBe(1);
  });

  it.each(['email', 'phone'] as const)(
    'rejects a %s collision owned by another provider identity',
    async (field) => {
      const existingSubject = randomUUID();
      const collidingSubject = randomUUID();
      const existingProviderUser = authoritativeUser(existingSubject);
      await prisma.user.create({
        data: {
          authProviderUserId: existingSubject,
          email: existingProviderUser.email,
          fullName: 'Existing User',
          phone: existingProviderUser.phone,
        },
      });
      provider.user = authoritativeUser(collidingSubject, {
        [field]: existingProviderUser[field],
      });

      await expect(
        service.provision(identityContext(collidingSubject), { fullName: 'Colliding User' }),
      ).rejects.toMatchObject({ code: 'AUTH_IDENTITY_CONFLICT' });
      await expect(prisma.user.count()).resolves.toBe(1);
    },
  );

  it('rejects authoritative identity mismatch instead of impersonating another user', async () => {
    provider.user = authoritativeUser(randomUUID());

    await expect(
      service.provision(identityContext(randomUUID()), { fullName: 'Impersonator' }),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_TOKEN' });
    await expect(prisma.user.count()).resolves.toBe(0);
  });
});
