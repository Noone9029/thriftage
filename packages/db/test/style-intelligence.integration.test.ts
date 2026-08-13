import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(testDatabaseUrl);

async function clear(): Promise<void> {
  await prisma.personalizationAudit.deleteMany();
  await prisma.recommendationEvent.deleteMany();
  await prisma.recommendationFeedback.deleteMany();
  await prisma.listingStyle.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.userStyleProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser() {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `style-${id}`,
      email: `${id}@example.com`,
      fullName: 'Style Test User',
    },
  });
}

describe.sequential('style intelligence database invariants', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await clear();
  });
  afterEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('keeps a private normalized profile with unique preferences', async () => {
    const user = await createUser();
    const style = await prisma.styleDefinition.findFirstOrThrow({ where: { slug: 'streetwear' } });
    const profile = await prisma.userStyleProfile.create({
      data: { priorities: ['AESTHETICS'], quizStatus: 'COMPLETED', quizStep: 6, userId: user.id },
    });
    await prisma.userStylePreference.create({
      data: { profileId: profile.id, strength: 5, styleDefinitionId: style.id },
    });
    await expect(
      prisma.userStylePreference.create({
        data: { profileId: profile.id, strength: 4, styleDefinitionId: style.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.userStylePreference.create({
        data: {
          profileId: profile.id,
          strength: 6,
          styleDefinitionId: (
            await prisma.styleDefinition.findFirstOrThrow({ where: { slug: 'vintage' } })
          ).id,
        },
      }),
    ).rejects.toThrow();
  });

  it('allows only one active scoring configuration and preserves hidden feedback uniqueness', async () => {
    const user = await createUser();
    const seller = await createUser();
    const category = await prisma.category.create({
      data: { name: 'Style test', slug: `style-test-${randomUUID()}` },
    });
    const listing = await prisma.listing.create({
      data: {
        categoryId: category.id,
        condition: 'GOOD',
        currency: 'PKR',
        description: 'A valid normalized test listing for style intelligence.',
        priceMinor: 200_000,
        sellerId: seller.id,
        size: 'M',
        status: 'ACTIVE',
        title: 'Style intelligence test',
      },
    });
    await prisma.recommendationFeedback.create({
      data: { hiddenAt: new Date(), listingId: listing.id, userId: user.id },
    });
    await expect(
      prisma.recommendationFeedback.create({
        data: { hiddenAt: new Date(), listingId: listing.id, userId: user.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.recommendationEvent.create({
        data: {
          listingId: listing.id,
          matchScore: 101,
          source: 'FOR_YOU',
          type: 'IMPRESSION',
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.recommendationConfiguration.create({
        data: { isActive: true, version: `test-${randomUUID()}` },
      }),
    ).rejects.toThrow();
  });
});
