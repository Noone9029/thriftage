import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) {
  throw new Error('TEST_DATABASE_URL is required for phone verification database tests.');
}

const prisma = createPrismaClient(testDatabaseUrl);

describe.sequential('PhoneVerificationAttempt database invariants', () => {
  beforeAll(async () => prisma.$connect());
  afterEach(async () => {
    await prisma.phoneVerificationAttempt.deleteMany();
    await prisma.user.deleteMany();
  });
  afterAll(async () => {
    await prisma.phoneVerificationAttempt.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  async function createUser() {
    const id = randomUUID();
    return prisma.user.create({
      data: {
        authProviderUserId: `provider-${id}`,
        email: `${id}@example.com`,
        fullName: 'Attempt Owner',
      },
    });
  }

  it('requires every attempt to belong to an existing user', async () => {
    await expect(
      prisma.phoneVerificationAttempt.create({
        data: {
          expiresAt: new Date(Date.now() + 600_000),
          phone: '+923001234567',
          resendAvailableAt: new Date(Date.now() + 60_000),
          userId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });

  it('deletes verification workflow state when its owner is deleted', async () => {
    const user = await createUser();
    await prisma.phoneVerificationAttempt.create({
      data: {
        expiresAt: new Date(Date.now() + 600_000),
        phone: '+923001234567',
        resendAvailableAt: new Date(Date.now() + 60_000),
        userId: user.id,
      },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await expect(prisma.phoneVerificationAttempt.count()).resolves.toBe(0);
  });

  it('rejects LINKED state without provider and link timestamps', async () => {
    const user = await createUser();
    await expect(
      prisma.phoneVerificationAttempt.create({
        data: {
          expiresAt: new Date(Date.now() + 600_000),
          phone: '+923001234567',
          resendAvailableAt: new Date(Date.now() + 60_000),
          status: 'LINKED',
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid negative workflow counters at the database boundary', async () => {
    const user = await createUser();
    await expect(
      prisma.phoneVerificationAttempt.create({
        data: {
          expiresAt: new Date(Date.now() + 600_000),
          phone: '+923001234567',
          resendAvailableAt: new Date(Date.now() + 60_000),
          sendCount: -1,
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
  });
});
