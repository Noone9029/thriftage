import { randomUUID } from 'node:crypto';

import { createPrismaClient } from '@thriftage/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AccountDeletionAuthAdmin } from './account-deletion-auth.interface';
import { AccountDeletionRepository } from './account-deletion.repository';
import { AccountDeletionWorker } from './account-deletion.worker';
import type { ListingImageStorage } from '../listing-media/listing-image-storage.interface';
import type { ProfileImageStorage } from '../profiles/profile-image-storage.interface';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(testDatabaseUrl);

async function clear(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "financial_entries", "inventory_movements", "settlement_allocations", "settlements" CASCADE',
  );
  await prisma.adminPermissionGrant.deleteMany();
  await prisma.payoutItem.deleteMany();
  await prisma.payoutBatch.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.sellerPayoutProfile.deleteMany();
  await prisma.aiResponseFeedback.deleteMany();
  await prisma.betaFeedback.deleteMany();
  await prisma.accountDeletionRequest.deleteMany();
  await prisma.pushDelivery.deleteMany();
  await prisma.pushDevice.deleteMany();
  await prisma.notificationOutbox.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.aiAttributionEvent.deleteMany();
  await prisma.savedOutfit.deleteMany();
  await prisma.aiStylistConversation.deleteMany();
  await prisma.recommendationEvent.deleteMany();
  await prisma.recommendationFeedback.deleteMany();
  await prisma.userStyleProfile.deleteMany();
  await prisma.listingLike.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.reviewReport.deleteMany();
  await prisma.review.deleteMany();
  await prisma.disputeEvent.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.paymentProviderEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.messageModerationAudit.deleteMany();
  await prisma.messageModerationFlag.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingStyle.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.phoneVerificationAttempt.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

describe.sequential('account deletion workflow', () => {
  beforeAll(async () => {
    vi.stubEnv('ACCOUNT_DELETION_ENABLED', 'true');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-placeholder');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-placeholder');
    vi.stubEnv('SUPABASE_URL', 'https://project-ref.supabase.co');
    vi.stubEnv('TWILIO_ACCOUNT_SID', `AC${'1'.repeat(32)}`);
    vi.stubEnv('TWILIO_API_KEY_SECRET', 'test-api-key-secret-placeholder');
    vi.stubEnv('TWILIO_API_KEY_SID', `SK${'2'.repeat(32)}`);
    vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', `VA${'3'.repeat(32)}`);
    await prisma.$connect();
    await clear();
  });
  afterEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('removes personal domains, anonymizes retained commerce, and completes idempotently', async () => {
    const suffix = randomUUID();
    const sellerId = randomUUID();
    const profileKey = `profiles/${sellerId}/${randomUUID()}.webp`;
    const sellerUsername = `delete_${suffix.replaceAll('-', '').slice(0, 12)}`;
    const buyerUsername = `buyer_${suffix.replaceAll('-', '').slice(0, 12)}`;
    const [seller, buyer] = await Promise.all([
      prisma.user.create({
        data: {
          authProviderUserId: `delete-seller-${suffix}`,
          email: `seller-${suffix}@example.com`,
          fullName: 'Deleting Seller',
          id: sellerId,
          phone: '+923001234567',
          profile: {
            create: {
              bio: 'Personal seller biography',
              profileImageKey: profileKey,
              profileImageUrl: `https://media.example/${profileKey}`,
              username: sellerUsername,
            },
          },
          pushDevices: {
            create: { expoPushToken: `ExponentPushToken[${suffix}]`, platform: 'ANDROID' },
          },
        },
      }),
      prisma.user.create({
        data: {
          authProviderUserId: `delete-buyer-${suffix}`,
          email: `buyer-${suffix}@example.com`,
          fullName: 'Retained Buyer',
          profile: {
            create: { username: buyerUsername },
          },
        },
      }),
    ]);
    const category = await prisma.category.create({
      data: { name: 'Deletion test', slug: `deletion-${suffix}` },
    });
    const listingId = randomUUID();
    const listingImageKey = `listings/${seller.id}/${listingId}/${randomUUID()}.webp`;
    const listing = await prisma.listing.create({
      data: {
        categoryId: category.id,
        condition: 'GOOD',
        currency: 'PKR',
        description: 'Personal listing description',
        images: {
          create: {
            height: 1200,
            position: 0,
            storageKey: listingImageKey,
            width: 900,
          },
        },
        priceMinor: 150_000,
        id: listingId,
        sellerId: seller.id,
        size: 'M',
        status: 'SOLD',
        stockAvailable: 0,
        stockSold: 1,
        title: 'Personal listing title',
      },
    });
    await prisma.savedListing.create({ data: { listingId: listing.id, userId: seller.id } });
    await prisma.aiStylistConversation.create({
      data: {
        messages: { create: { content: 'Private styling request', role: 'USER' } },
        title: 'Private stylist chat',
        userId: seller.id,
      },
    });
    const completedAt = new Date();
    const order = await prisma.order.create({
      data: {
        addressLine1: '1 Private Street',
        buyerId: buyer.id,
        buyerUsername,
        city: 'Lahore',
        completedAt,
        confirmedAt: completedAt,
        countryCode: 'PK',
        currency: 'PKR',
        deliveredAt: completedAt,
        deliveryPhone: '+923001111111',
        idempotencyKey: randomUUID(),
        listingId: listing.id,
        listingImageKey,
        listingTitle: listing.title,
        orderNumber: `DEL-${suffix.replaceAll('-', '').slice(0, 20)}`,
        paymentMethod: 'CASH_ON_DELIVERY',
        priceMinor: 150_000,
        itemSubtotalMinor: 150_000,
        commissionMinor: 15_000,
        sellerNetMinor: 135_000,
        financialPolicyVersion: 'marketplace-fees-v1',
        withholdingRuleVersion: 'withholding-unapproved-v1',
        recipientName: 'Retained Buyer',
        region: 'Punjab',
        sellerId: seller.id,
        sellerUsername,
        shippedAt: completedAt,
        status: 'COMPLETED',
        totalMinor: 150_000,
      },
    });

    const repository = new AccountDeletionRepository(prisma);
    await repository.request(seller.id, seller.authProviderUserId);

    const removedProfiles: string[] = [];
    const removedListings: string[][] = [];
    const profileStorage: ProfileImageStorage = {
      getPublicUrl: vi.fn(),
      remove: async (key) => {
        removedProfiles.push(key);
      },
      upload: vi.fn(),
    };
    const listingStorage: ListingImageStorage = {
      createSignedUrls: vi.fn(),
      remove: async (keys) => {
        removedListings.push([...keys]);
      },
      upload: vi.fn(),
    };
    const deletedIdentities: string[] = [];
    const authAdmin: AccountDeletionAuthAdmin = {
      deleteIdentity: async (id) => {
        deletedIdentities.push(id);
      },
      revokeSession: vi.fn(),
    };
    const worker = new AccountDeletionWorker(repository, authAdmin, profileStorage, listingStorage);
    await worker.tick();
    await worker.tick();

    const [deletion, anonymizedUser, deletedProfile, anonymizedListing, retainedOrder] =
      await Promise.all([
        prisma.accountDeletionRequest.findUniqueOrThrow({ where: { userId: seller.id } }),
        prisma.user.findUniqueOrThrow({ where: { id: seller.id } }),
        prisma.profile.findUnique({ where: { userId: seller.id } }),
        prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }),
        prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      ]);

    expect(deletion).toMatchObject({
      authProviderUserId: null,
      status: 'COMPLETED',
    });
    expect(deletion.completedAt).not.toBeNull();
    expect(anonymizedUser).toMatchObject({
      accountStatus: 'DEACTIVATED',
      email: null,
      fullName: 'Deleted account',
      phone: null,
    });
    expect(anonymizedUser.authProviderUserId).toBe(`deleted:${seller.id}`);
    expect(deletedProfile).toBeNull();
    expect(anonymizedListing).toMatchObject({
      description: 'Removed after account deletion.',
      status: 'ARCHIVED',
      title: 'Deleted listing',
    });
    expect(await prisma.listingImage.count({ where: { listingId: listing.id } })).toBe(0);
    expect(await prisma.aiStylistConversation.count({ where: { userId: seller.id } })).toBe(0);
    expect(await prisma.pushDevice.count({ where: { userId: seller.id } })).toBe(0);
    expect(retainedOrder).toMatchObject({
      listingImageKey: null,
      listingTitle: 'Deleted listing',
      priceMinor: 150_000,
      sellerUsername: 'deleted-user',
      totalMinor: 150_000,
    });
    expect(removedProfiles).toEqual([profileKey]);
    expect(removedListings).toEqual([[listingImageKey]]);
    expect(deletedIdentities).toEqual([seller.authProviderUserId]);
  });
});
