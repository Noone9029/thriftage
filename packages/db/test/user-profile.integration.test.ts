import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/client';
import type { Prisma, PrismaClient } from '../src/generated/client/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
}

const prisma = createPrismaClient(testDatabaseUrl);

function createUserData(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  const uniqueValue = randomUUID();

  return {
    authProviderUserId: `supabase-${uniqueValue}`,
    email: `${uniqueValue}@example.com`,
    fullName: 'Database Test User',
    phone: `+92${uniqueValue.replaceAll('-', '').slice(0, 10)}`,
    ...overrides,
  };
}

async function clearIdentityTables(client: PrismaClient): Promise<void> {
  await client.profile.deleteMany();
  await client.user.deleteMany();
}

describe.sequential('User and Profile database invariants', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await clearIdentityTables(prisma);
  });

  afterAll(async () => {
    await clearIdentityTables(prisma);
    await prisma.$disconnect();
  });

  it('requires a nonblank external auth-provider identity', async () => {
    await expect(
      prisma.user.create({ data: createUserData({ authProviderUserId: '   ' }) }),
    ).rejects.toThrow();
  });

  it('enforces authProviderUserId uniqueness', async () => {
    const authProviderUserId = `supabase-${randomUUID()}`;
    await prisma.user.create({ data: createUserData({ authProviderUserId }) });

    await expect(
      prisma.user.create({ data: createUserData({ authProviderUserId }) }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces email uniqueness when email is non-null', async () => {
    const email = `${randomUUID()}@example.com`;
    await prisma.user.create({ data: createUserData({ email }) });

    await expect(prisma.user.create({ data: createUserData({ email }) })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows multiple users without an email address', async () => {
    await prisma.user.create({ data: createUserData({ email: null }) });
    await prisma.user.create({ data: createUserData({ email: null }) });

    await expect(prisma.user.count({ where: { email: null } })).resolves.toBe(2);
  });

  it('enforces phone uniqueness when phone is non-null', async () => {
    const phone = `+92${randomUUID().replaceAll('-', '').slice(0, 10)}`;
    await prisma.user.create({ data: createUserData({ phone }) });

    await expect(prisma.user.create({ data: createUserData({ phone }) })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows multiple users without a phone number', async () => {
    await prisma.user.create({ data: createUserData({ phone: null }) });
    await prisma.user.create({ data: createUserData({ phone: null }) });

    await expect(prisma.user.count({ where: { phone: null } })).resolves.toBe(2);
  });

  it('enforces username uniqueness', async () => {
    const firstUser = await prisma.user.create({ data: createUserData() });
    const secondUser = await prisma.user.create({ data: createUserData() });
    await prisma.profile.create({
      data: { user: { connect: { id: firstUser.id } }, username: 'unique_name' },
    });

    await expect(
      prisma.profile.create({
        data: { user: { connect: { id: secondUser.id } }, username: 'unique_name' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('prevents one user from owning multiple profiles', async () => {
    const user = await prisma.user.create({ data: createUserData() });
    await prisma.profile.create({
      data: { user: { connect: { id: user.id } }, username: 'first_profile' },
    });

    await expect(
      prisma.$executeRaw`
        INSERT INTO "profiles" ("id", "user_id", "username", "updated_at")
        VALUES (${randomUUID()}::uuid, ${user.id}::uuid, 'second_profile', CURRENT_TIMESTAMP)
      `,
    ).rejects.toThrow();
  });

  it('requires every profile to reference an existing user', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "profiles" ("id", "user_id", "username", "updated_at")
        VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, ${`orphan_${randomUUID().slice(0, 8)}`}, CURRENT_TIMESTAMP)
      `,
    ).rejects.toThrow();
  });

  it('defaults completedSalesCount to zero', async () => {
    const user = await prisma.user.create({ data: createUserData() });
    const profile = await prisma.profile.create({
      data: { user: { connect: { id: user.id } }, username: 'default_sales' },
    });

    expect(profile.completedSalesCount).toBe(0);
  });

  it('defaults accountStatus to ACTIVE', async () => {
    const user = await prisma.user.create({ data: createUserData() });

    expect(user.accountStatus).toBe('ACTIVE');
  });

  it('defaults role to USER', async () => {
    const user = await prisma.user.create({ data: createUserData() });

    expect(user.role).toBe('USER');
  });
});
