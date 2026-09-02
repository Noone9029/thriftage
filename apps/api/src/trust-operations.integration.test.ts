import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@thriftage/db';

import { DisputeRepository } from './disputes/dispute.repository';
import { ReviewRepository } from './reviews/review.repository';
import { SellerVerificationRepository } from './seller-verification/seller-verification.repository';
import { PolicyRepository } from './trust/policy.repository';
import { ReputationReader } from './trust/reputation.reader';
import { SafetyRepository } from './trust/safety.repository';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(databaseUrl);
const reviews = new ReviewRepository(prisma);
const reputation = new ReputationReader(prisma);
const safety = new SafetyRepository(prisma);
const policies = new PolicyRepository(prisma);
const disputes = new DisputeRepository(prisma);
const verification = new SellerVerificationRepository(prisma);

async function clear(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "financial_entries", "inventory_movements", "settlement_allocations", "settlements" CASCADE',
  );
  await prisma.adminPermissionGrant.deleteMany();
  await prisma.payoutItem.deleteMany();
  await prisma.payoutBatch.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.sellerPayoutProfile.deleteMany();
  await prisma.pushDelivery.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationOutbox.deleteMany();
  await prisma.trustAudit.deleteMany();
  await prisma.safetyAction.deleteMany();
  await prisma.userRestriction.deleteMany();
  await prisma.sellerVerification.deleteMany();
  await prisma.disputeEvent.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.policyAcceptance.deleteMany();
  await prisma.policyVersion.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.reviewModerationAudit.deleteMany();
  await prisma.reviewReport.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.paymentProviderEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.moderationAudit.deleteMany();
  await prisma.moderationReport.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.listingLike.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.pushDevice.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.phoneVerificationAttempt.deleteMany();
  await prisma.user.deleteMany();
}

async function user(prefix: string, role: 'ADMIN' | 'USER' = 'USER') {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `trust-${id}`,
      email: `${id}@example.com`,
      emailVerified: true,
      phone: `+1555${Math.floor(1000000 + Math.random() * 8999999)}`,
      phoneVerified: true,
      fullName: prefix,
      profile: { create: { username: `${prefix}_${id.slice(0, 6)}` } },
      role,
    },
    include: { profile: true },
  });
}

async function completedOrder() {
  const seller = await user('seller');
  const buyer = await user('buyer');
  const category = await prisma.category.create({
    data: { name: `Category ${randomUUID().slice(0, 5)}`, slug: randomUUID() },
  });
  const listing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      title: 'Transaction-backed vintage jacket',
      description: 'A completed transaction fixture for trust and reputation invariants.',
      priceMinor: 250_000,
      currency: 'PKR',
      condition: 'GOOD',
      size: 'M',
      status: 'SOLD',
      stockAvailable: 0,
      stockSold: 1,
    },
  });
  const completedAt = new Date(Date.now() - 24 * 3600000);
  const order = await prisma.order.create({
    data: {
      orderNumber: `THR-${randomUUID().slice(0, 8).toUpperCase()}`,
      idempotencyKey: randomUUID(),
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      listingTitle: listing.title,
      buyerUsername: buyer.profile!.username,
      sellerUsername: seller.profile!.username,
      priceMinor: listing.priceMinor,
      itemSubtotalMinor: listing.priceMinor,
      commissionMinor: 25_000,
      sellerNetMinor: 225_000,
      financialPolicyVersion: 'marketplace-fees-v1',
      withholdingRuleVersion: 'withholding-unapproved-v1',
      totalMinor: listing.priceMinor,
      currency: 'PKR',
      paymentMethod: 'CASH_ON_DELIVERY',
      status: 'COMPLETED',
      recipientName: 'Trust Fixture',
      deliveryPhone: '+15551234567',
      addressLine1: '10 Test Street',
      city: 'Lahore',
      region: 'Punjab',
      countryCode: 'PK',
      completedAt,
      deliveredAt: completedAt,
      shippedAt: completedAt,
    },
  });
  return { buyer, category, listing, order, seller };
}

describe.sequential('trust, reputation, and marketplace operations', () => {
  beforeAll(async () => prisma.$connect());
  afterEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('enforces one transaction-backed review per direction and excludes invalidated ratings', async () => {
    const { buyer, order, seller } = await completedOrder();
    const buyerReview = await reviews.create(buyer.id, {
      orderId: order.id,
      rating: 5,
      text: 'Accurate item and careful handoff.',
    });
    await reviews.create(seller.id, {
      orderId: order.id,
      rating: 4,
      text: 'Reliable buyer and clear communication.',
    });
    await expect(reviews.create(buyer.id, { orderId: order.id, rating: 1 })).rejects.toMatchObject({
      code: 'REVIEW_ALREADY_SUBMITTED',
    });
    expect(await prisma.review.count({ where: { orderId: order.id } })).toBe(2);
    expect(
      (await reputation.summaries([seller.id], 'BUYER_TO_SELLER')).get(seller.id),
    ).toMatchObject({ average: 5, count: 1 });
    const admin = await user('review_admin', 'ADMIN');
    await reviews.moderate(
      admin.id,
      buyerReview.id,
      'INVALIDATE',
      'Confirmed manipulation pattern.',
    );
    expect(
      (await new ReputationReader(prisma).summaries([seller.id], 'BUYER_TO_SELLER')).get(seller.id),
    ).toMatchObject({ average: null, count: 0 });
  });

  it('removes follows and blocks new interactions without deleting transaction history', async () => {
    const { buyer, order, seller } = await completedOrder();
    await prisma.follow.create({ data: { followerId: buyer.id, followedId: seller.id } });
    await safety.block(buyer.id, seller.id);
    expect(await prisma.follow.count()).toBe(0);
    await expect(safety.assertPairAllowed(buyer.id, seller.id)).rejects.toMatchObject({
      code: 'INTERACTION_NOT_AVAILABLE',
    });
    expect(await prisma.order.findUnique({ where: { id: order.id } })).not.toBeNull();
    expect(await safety.blockedCounterpartIds(seller.id)).toContain(buyer.id);
  });

  it('versions policy acceptance and requires acceptance of newly current versions', async () => {
    const member = await user('policy_member');
    const admin = await user('policy_admin', 'ADMIN');
    const first = await policies.publish(admin.id, {
      policyType: 'COMMUNITY_GUIDELINES',
      version: '1.0',
      title: 'Community Guidelines',
      url: 'https://thriftage.example/policies/community/1',
      effectiveAt: new Date(Date.now() - 1000).toISOString(),
      requiredForUgc: true,
    });
    await policies.accept(member.id, [first.id]);
    expect(
      await prisma.policyAcceptance.count({
        where: { userId: member.id, policyVersionId: first.id },
      }),
    ).toBe(1);
    const second = await policies.publish(admin.id, {
      policyType: 'COMMUNITY_GUIDELINES',
      version: '1.1',
      title: 'Community Guidelines',
      url: 'https://thriftage.example/policies/community/1-1',
      effectiveAt: new Date(Date.now() - 1000).toISOString(),
      requiredForUgc: true,
    });
    expect(
      await prisma.policyAcceptance.count({
        where: { userId: member.id, policyVersionId: second.id },
      }),
    ).toBe(0);
    await expect(policies.accept(member.id, [first.id])).rejects.toMatchObject({
      code: 'POLICY_ACCEPTANCE_REQUIRED',
    });
    await policies.accept(member.id, [second.id]);
  });

  it('keeps one participant-authorized dispute with an auditable resolution timeline', async () => {
    const { buyer, order, seller } = await completedOrder();
    const outsider = await user('outsider');
    const admin = await user('dispute_admin', 'ADMIN');
    const dispute = await disputes.create(
      buyer.id,
      {
        orderId: order.id,
        reason: 'ITEM_NOT_AS_DESCRIBED',
        description: 'The received item materially differs from the approved listing description.',
      },
      336,
      0,
    );
    expect(await disputes.participant(outsider.id, dispute.id)).toBeNull();
    await expect(
      disputes.create(
        seller.id,
        {
          orderId: order.id,
          reason: 'OTHER',
          description: 'A second case should not be created for the same transaction.',
        },
        336,
        0,
      ),
    ).rejects.toMatchObject({ code: 'DISPUTE_ALREADY_EXISTS' });
    const resolved = await disputes.action(admin.id, dispute.id, {
      action: 'RESOLVE',
      note: 'Reviewed participant evidence and transaction history.',
      resolution: 'Case documented and closed without inventing a financial remedy.',
    });
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.events.map(({ type }) => type)).toContain('RESOLUTION_RECORDED');
    expect(await prisma.trustAudit.count({ where: { disputeId: dispute.id } })).toBe(1);
    await expect(
      disputes.action(admin.id, dispute.id, {
        action: 'REQUEST_INFORMATION',
        note: 'A resolved case cannot request new information without being reopened.',
      }),
    ).rejects.toMatchObject({ code: 'DISPUTE_TRANSITION_INVALID' });
  });

  it('awards the account-review badge only after an eligible case is approved', async () => {
    const applicant = await user('verified_seller');
    const admin = await user('verification_admin', 'ADMIN');
    const state = await verification.eligibility(applicant.id, 0);
    expect(state.eligible).toBe(true);
    const pending = await verification.apply(
      applicant.id,
      'I represent item condition accurately and keep marketplace communication on-platform.',
      0,
    );
    expect((await reputation.verified([applicant.id])).has(applicant.id)).toBe(false);
    await verification.decide(
      admin.id,
      pending.id,
      'APPROVE',
      'Account history and profile requirements reviewed.',
      30,
    );
    // The shared reader intentionally caches display-only verification state. A fresh request
    // reader must observe the committed decision immediately.
    expect((await new ReputationReader(prisma).verified([applicant.id])).has(applicant.id)).toBe(
      true,
    );
  });

  it('enforces scoped restrictions and records immutable safety actions', async () => {
    const member = await user('restricted_member');
    const admin = await user('safety_admin', 'ADMIN');
    const restriction = await safety.applyRestriction(admin.id, member.id, {
      scope: 'MESSAGING',
      reason: 'Repeated off-platform contact attempts.',
    });
    await expect(safety.assertScopeAllowed(member.id, 'MESSAGING')).rejects.toMatchObject({
      code: 'INTERACTION_NOT_AVAILABLE',
    });
    await safety.assertScopeAllowed(member.id, 'BUYING');
    expect(await prisma.safetyAction.count({ where: { restrictionId: restriction.id } })).toBe(1);
    expect(await prisma.trustAudit.count({ where: { restrictionId: restriction.id } })).toBe(1);
    await safety.revokeRestriction(admin.id, restriction.id, 'Restriction reviewed and lifted.');
    await safety.assertScopeAllowed(member.id, 'MESSAGING');
    expect((await safety.recentSafetyActions(member.id)).map(({ type }) => type)).toEqual([
      'RESTRICTION_REVOKED',
      'PERMANENT_RESTRICTION',
    ]);
  });
});
