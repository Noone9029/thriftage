import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@thriftage/db';

import type {
  MarketplaceEvent,
  MarketplaceEventPublisher,
} from './common/marketplace-event-publisher';
import { DiscoveryRepository } from './discovery/discovery.repository';
import type { ListingImageStorage } from './listing-media/listing-image-storage.interface';
import { ListingPresenter } from './listings/listing.presenter';
import { ListingRepository } from './listings/listing.repository';
import { ListingService } from './listings/listing.service';
import { ModerationRepository } from './moderation/moderation.repository';
import { SocialRepository } from './social/social.repository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(testDatabaseUrl);

class FakeStorage implements ListingImageStorage {
  public createSignedUrls(keys: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(
      new Map(keys.map((key) => [key, `https://media.example/${key}?token=test`])),
    );
  }
  public remove(): Promise<void> {
    return Promise.resolve();
  }
  public upload(): Promise<void> {
    return Promise.resolve();
  }
}

class CapturingEvents implements MarketplaceEventPublisher {
  public readonly events: MarketplaceEvent[] = [];
  public publish(event: MarketplaceEvent): void {
    this.events.push(event);
  }
}

const storage = new FakeStorage();
const events = new CapturingEvents();
const listings = new ListingRepository(prisma);
const reputation = {
  summaries: (userIds: readonly string[]) =>
    Promise.resolve(
      new Map(
        userIds.map((id) => [
          id,
          {
            average: null,
            count: 0,
            distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
          },
        ]),
      ),
    ),
  verified: () => Promise.resolve(new Set()),
};
const presenter = new ListingPresenter(storage, reputation as never);
const policy = { assertUgcAccepted: () => Promise.resolve() };
const safety = { assertScopeAllowed: () => Promise.resolve() };
const listingService = new ListingService(
  listings,
  presenter,
  storage,
  events,
  policy as never,
  safety as never,
);
const moderation = new ModerationRepository(prisma);
const social = new SocialRepository(prisma);
const discovery = new DiscoveryRepository(prisma);

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
  events.events.length = 0;
}

async function user(username: string, role: 'ADMIN' | 'USER' = 'USER') {
  const value = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `market-${value}`,
      email: `${value}@example.com`,
      fullName: username,
      profile: { create: { username } },
      role,
    },
  });
}

async function category() {
  return prisma.category.create({ data: { name: 'Vintage Clothing', slug: 'vintage-clothing' } });
}

const draftInput = (categoryId: string, title = 'Vintage denim overshirt') => ({
  categoryId,
  condition: 'GOOD' as const,
  currency: 'PKR' as const,
  description: 'A carefully photographed vintage layer in excellent wearable condition.',
  priceMinor: 275_000,
  size: 'M',
  title,
});

async function addImages(sellerId: string, listingId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await listings.addImage(sellerId, listingId, {
      height: 1200,
      storageKey: `listings/${sellerId}/${listingId}/${randomUUID()}.webp`,
      width: 900,
    });
  }
}

describe.sequential('marketplace integration', () => {
  beforeAll(async () => prisma.$connect());
  afterEach(clearMarketplace);
  afterAll(async () => {
    await clearMarketplace();
    await prisma.$disconnect();
  });

  it('moves a complete owned draft through submission and audited approval', async () => {
    const seller = await user('approval_seller');
    const admin = await user('approval_admin', 'ADMIN');
    const selectedCategory = await category();
    const draft = await listingService.create(seller.id, draftInput(selectedCategory.id));
    await addImages(seller.id, draft.id, 3);

    const pending = await listingService.submit(seller.id, draft.id);
    expect(pending.status).toBe('PENDING_REVIEW');
    const active = await moderation.moderateListing(admin.id, draft.id, 'APPROVE');
    expect(active.status).toBe('ACTIVE');
    await expect(moderation.listListingAudits(draft.id)).resolves.toMatchObject([
      { action: 'LISTING_APPROVED', actorId: admin.id },
    ]);
    await expect(listingService.getPublic(draft.id)).resolves.toMatchObject({
      id: draft.id,
      images: [{ position: 0 }, { position: 1 }, { position: 2 }],
      status: 'ACTIVE',
    });
  });

  it('locks concurrent media additions at the ten-image boundary', async () => {
    const seller = await user('media_seller');
    const selectedCategory = await category();
    const draft = await listings.createDraft(seller.id, draftInput(selectedCategory.id));
    await addImages(seller.id, draft.id, 5);
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        listings.addImage(seller.id, draft.id, {
          height: 1000,
          storageKey: `listings/${seller.id}/${draft.id}/${randomUUID()}.webp`,
          width: 800,
        }),
      ),
    );
    expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(5);
    await expect(prisma.listingImage.count({ where: { listingId: draft.id } })).resolves.toBe(10);
  });

  it('keeps likes and saves idempotent and rejects seller self-engagement', async () => {
    const seller = await user('social_owner');
    const buyer = await user('social_viewer');
    const selectedCategory = await category();
    const listing = await prisma.listing.create({
      data: { ...draftInput(selectedCategory.id), sellerId: seller.id, status: 'ACTIVE' },
    });
    await expect(social.setLike(buyer.id, listing.id, true)).resolves.toMatchObject({ count: 1 });
    await expect(social.setLike(buyer.id, listing.id, true)).resolves.toMatchObject({ count: 1 });
    await expect(social.setSaved(seller.id, listing.id, true)).rejects.toMatchObject({
      code: 'SELF_INTERACTION_FORBIDDEN',
    });
  });

  it('paginates filtered search without duplicates', async () => {
    const seller = await user('search_seller');
    const selectedCategory = await category();
    for (const title of ['Vintage coat alpha', 'Vintage coat beta', 'Vintage coat gamma']) {
      await prisma.listing.create({
        data: { ...draftInput(selectedCategory.id, title), sellerId: seller.id, status: 'ACTIVE' },
      });
    }
    const first = await listingService.search({ limit: 2, q: 'coat', sort: 'NEWEST' });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await listingService.search({
      cursor: first.nextCursor ?? undefined,
      limit: 2,
      q: 'coat',
      sort: 'NEWEST',
    });
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map(({ id }) => id)).size).toBe(3);
  });

  it('boosts followed sellers in deterministic recommended discovery', async () => {
    const viewer = await user('feed_viewer');
    const followedSeller = await user('followed_seller');
    const otherSeller = await user('other_seller');
    const selectedCategory = await category();
    await prisma.follow.create({ data: { followedId: followedSeller.id, followerId: viewer.id } });
    const followedListing = await prisma.listing.create({
      data: {
        ...draftInput(selectedCategory.id, 'Followed seller piece'),
        sellerId: followedSeller.id,
        status: 'ACTIVE',
      },
    });
    await prisma.listing.create({
      data: {
        ...draftInput(selectedCategory.id, 'Other seller piece'),
        sellerId: otherSeller.id,
        status: 'ACTIVE',
      },
    });
    const ranked = await discovery.rank('RECOMMENDED', viewer.id, new Date(), null, 10);
    expect(ranked.ranks[0]?.id).toBe(followedListing.id);
  });

  it('prevents duplicate open reports and records resolution audits', async () => {
    const reporter = await user('safety_reporter');
    const seller = await user('safety_seller');
    const admin = await user('safety_admin', 'ADMIN');
    const selectedCategory = await category();
    const listing = await prisma.listing.create({
      data: { ...draftInput(selectedCategory.id), sellerId: seller.id, status: 'ACTIVE' },
    });
    const report = await moderation.createListingReport(reporter.id, {
      listingId: listing.id,
      reason: 'MISLEADING_CONTENT',
    });
    await expect(
      moderation.createListingReport(reporter.id, {
        listingId: listing.id,
        reason: 'SPAM',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_REPORT' });
    await moderation.updateReport(admin.id, report.id, {
      resolution: 'Reviewed evidence and removed the listing.',
      status: 'ACTIONED',
    });
    await expect(
      prisma.moderationAudit.findFirst({ where: { reportId: report.id } }),
    ).resolves.toMatchObject({
      action: 'REPORT_ACTIONED',
      actorId: admin.id,
    });
  });
});
