import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@thriftage/db';

import { PersonalizationService } from './personalization.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(testDatabaseUrl);
const service = new PersonalizationService(prisma);

async function clear(): Promise<void> {
  await prisma.personalizationAudit.deleteMany();
  await prisma.recommendationEvent.deleteMany();
  await prisma.recommendationFeedback.deleteMany();
  await prisma.listingStyle.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.userStyleProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

async function user(name: string) {
  const suffix = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `personalization-${suffix}`,
      email: `${suffix}@example.com`,
      fullName: name,
      profile: { create: { username: `p_${suffix.replaceAll('-', '').slice(0, 20)}` } },
    },
  });
}

describe.sequential('personalization service integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await clear();
  });
  afterEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('autosaves, completes, versions, and resets a private structured profile', async () => {
    const viewer = await user('Viewer');
    const streetwear = await prisma.styleDefinition.findFirstOrThrow({
      where: { slug: 'streetwear' },
    });
    const input = {
      budgetMaxMinor: 500_000,
      budgetMinMinor: 100_000,
      colors: [{ colorFamily: 'BLACK' as const, sentiment: 'PREFER' as const }],
      currency: 'PKR' as const,
      expressions: ['CREATIVE' as const],
      fits: ['RELAXED' as const],
      lifestyles: ['STUDENT' as const],
      priorities: ['AESTHETICS' as const],
      quizStep: 4,
      sizes: [{ garmentRole: 'TOP' as const, sizeKey: 'M', sizeSystem: 'ALPHA' as const }],
      styles: [{ strength: 5, styleDefinitionId: streetwear.id }],
    };
    const saved = await service.save(viewer.id, input, false);
    expect(saved.quizStatus).toBe('IN_PROGRESS');
    const completed = await service.save(viewer.id, { ...input, quizStep: 6 }, true);
    expect(completed).toMatchObject({
      profileVersion: 2,
      quizStatus: 'COMPLETED',
      result: { primaryStyle: { slug: 'streetwear' } },
    });
    const reset = await service.resetProfile(viewer.id);
    expect(reset.quizStatus).toBe('NOT_STARTED');
  });

  it('excludes hidden inventory and honors undo without deleting feedback', async () => {
    const viewer = await user('Viewer');
    const seller = await user('Seller');
    const category = await prisma.category.create({
      data: { name: 'Personalization test', slug: `personalization-${randomUUID()}` },
    });
    const style = await prisma.styleDefinition.findFirstOrThrow({ where: { slug: 'streetwear' } });
    const listing = await prisma.listing.create({
      data: {
        categoryId: category.id,
        colorFamily: 'BLACK',
        condition: 'GOOD',
        currency: 'PKR',
        description: 'An eligible normalized personalized discovery listing.',
        fitType: 'RELAXED',
        garmentRole: 'TOP',
        priceMinor: 250_000,
        sellerId: seller.id,
        size: 'M',
        sizeCompatibilityKey: 'M',
        sizeSystem: 'ALPHA',
        status: 'ACTIVE',
        styles: { create: { styleDefinitionId: style.id } },
        title: 'Personalization listing',
      },
    });
    expect((await service.rankForYou(viewer.id, new Date())).ranked.map(({ id }) => id)).toContain(
      listing.id,
    );
    await service.setNotInterested(viewer.id, listing.id, true);
    expect(
      (await service.rankForYou(viewer.id, new Date())).ranked.map(({ id }) => id),
    ).not.toContain(listing.id);
    await service.setNotInterested(viewer.id, listing.id, false);
    expect((await service.rankForYou(viewer.id, new Date())).ranked.map(({ id }) => id)).toContain(
      listing.id,
    );
    await expect(
      prisma.recommendationFeedback.count({ where: { listingId: listing.id, userId: viewer.id } }),
    ).resolves.toBe(1);
  });
});
