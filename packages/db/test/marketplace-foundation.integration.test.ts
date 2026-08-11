import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
}

const prisma = createPrismaClient(testDatabaseUrl);

async function clearMarketplace(): Promise<void> {
  await prisma.moderationAudit.deleteMany();
  await prisma.moderationReport.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.listingLike.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.phoneVerificationAttempt.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(username: string) {
  const suffix = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `marketplace-${suffix}`,
      email: `${suffix}@example.com`,
      fullName: 'Marketplace Test User',
      profile: { create: { username } },
    },
  });
}

async function createListing(sellerId: string, categoryId: string) {
  return prisma.listing.create({
    data: {
      categoryId,
      condition: 'GOOD',
      currency: 'PKR',
      description: 'A detailed and accurate marketplace test listing.',
      priceMinor: 125_000,
      sellerId,
      size: 'M',
      title: 'Test marketplace listing',
    },
  });
}

describe.sequential('Marketplace database invariants', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await clearMarketplace();
  });
  afterEach(clearMarketplace);
  afterAll(async () => {
    await clearMarketplace();
    await prisma.$disconnect();
  });

  it('rejects invalid money and image positions at the database boundary', async () => {
    const seller = await createUser('market_seller');
    const category = await prisma.category.create({ data: { name: 'Clothing', slug: 'clothing' } });
    await expect(
      prisma.listing.create({
        data: {
          categoryId: category.id,
          condition: 'GOOD',
          currency: 'PKR',
          description: 'A detailed listing with an invalid price.',
          priceMinor: 0,
          sellerId: seller.id,
          size: 'M',
          title: 'Invalid price listing',
        },
      }),
    ).rejects.toThrow();

    const listing = await createListing(seller.id, category.id);
    await expect(
      prisma.listingImage.create({
        data: {
          height: 1000,
          listingId: listing.id,
          position: 10,
          storageKey: `listings/${seller.id}/${listing.id}/${randomUUID()}.webp`,
          width: 800,
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces unique social relationships and prevents self-following', async () => {
    const seller = await createUser('social_seller');
    const buyer = await createUser('social_buyer');
    const category = await prisma.category.create({ data: { name: 'Shoes', slug: 'shoes' } });
    const listing = await createListing(seller.id, category.id);

    await prisma.listingLike.create({ data: { listingId: listing.id, userId: buyer.id } });
    await expect(
      prisma.listingLike.create({ data: { listingId: listing.id, userId: buyer.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.follow.create({ data: { followedId: buyer.id, followerId: buyer.id } }),
    ).rejects.toThrow();
  });

  it('requires each report and audit to target exactly one supported record', async () => {
    const reporter = await createUser('reporter_user');
    const seller = await createUser('reported_user');
    const category = await prisma.category.create({ data: { name: 'Bags', slug: 'bags' } });
    const listing = await createListing(seller.id, category.id);

    await expect(
      prisma.moderationReport.create({
        data: {
          listingId: listing.id,
          reason: 'SPAM',
          reporterId: reporter.id,
          targetType: 'USER',
          targetUserId: seller.id,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.moderationAudit.create({
        data: {
          action: 'CATEGORY_UPDATED',
          actorId: reporter.id,
          categoryId: category.id,
          listingId: listing.id,
        },
      }),
    ).rejects.toThrow();
  });
});
