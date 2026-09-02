import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@thriftage/db';

import { CashOnDeliveryAdapter } from './commerce/cash-on-delivery.adapter';
import { OrderRepository } from './commerce/order.repository';
import { FinanceService } from './commerce/finance.service';
import type { PaymentProvider } from './commerce/payment-provider.interface';
import { CommunicationRepository } from './communication/communication.repository';
import { ContactInformationDetector } from './communication/contact-information-detector';
import { NotificationOutboxWorker } from './notifications/notification-outbox.worker';
import { NotificationRepository } from './notifications/notification.repository';
import type {
  PushProvider,
  PushReceipt,
  PushTicket,
} from './notifications/push-provider.interface';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
process.env.LOCAL_COURIER_ENABLED = 'true';
const prisma = createPrismaClient(databaseUrl);
const orders = new OrderRepository(new CashOnDeliveryAdapter(), prisma);
const finance = new FinanceService(prisma);
const communication = new CommunicationRepository(prisma);
const detector = new ContactInformationDetector();
class FakePush implements PushProvider {
  public sends = 0;
  public failNext = false;
  public send(): Promise<PushTicket> {
    this.sends += 1;
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('SYNTHETIC_TRANSIENT'));
    }
    return Promise.resolve({ id: `ticket-${this.sends}` });
  }
  public receipts(ids: readonly string[]): Promise<ReadonlyMap<string, PushReceipt>> {
    return Promise.resolve(new Map(ids.map((id) => [id, { status: 'ok' as const }])));
  }
}
const notificationRepository = new NotificationRepository(prisma);
const fakePush = new FakePush();
const notificationWorker = new NotificationOutboxWorker(notificationRepository, fakePush);

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
  await prisma.messageModerationAudit.deleteMany();
  await prisma.messageModerationFlag.deleteMany();
  await prisma.message.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.paymentProviderEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.listing.updateMany({
    data: { stockAvailable: 1, stockReserved: 0, stockSold: 0, status: 'ACTIVE' },
    where: { status: { in: ['RESERVED', 'SOLD'] } },
  });
  await prisma.order.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.address.deleteMany();
  await prisma.pushDevice.deleteMany();
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

async function user(username: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `trust-${id}`,
      email: `${id}@example.com`,
      emailVerified: true,
      fullName: username,
      phone: `+923${Math.floor(Math.random() * 1_000_000_000)
        .toString()
        .padStart(9, '0')}`,
      phoneVerified: true,
      profile: { create: { username } },
    },
  });
}

async function setup(
  status: 'ACTIVE' | 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'REMOVED' | 'ARCHIVED' = 'ACTIVE',
) {
  const seller = await user(`seller_${randomUUID().slice(0, 6)}`);
  const buyer = await user(`buyer_${randomUUID().slice(0, 6)}`);
  const category = await prisma.category.create({
    data: { name: `Clothing ${randomUUID().slice(0, 5)}`, slug: `clothing-${randomUUID()}` },
  });
  const listing = await prisma.listing.create({
    data: {
      categoryId: category.id,
      condition: 'GOOD',
      currency: 'PKR',
      description: 'A production-grade integration test marketplace listing.',
      priceMinor: 145_000,
      ...(status === 'REJECTED' ? { rejectionReason: 'Synthetic moderation reason' } : {}),
      sellerId: seller.id,
      size: 'M',
      status,
      title: 'Vintage denim jacket',
    },
  });
  const address = await prisma.address.create({
    data: {
      addressLine1: '10 Synthetic Test Street',
      city: 'Lahore',
      countryCode: 'PK',
      isDefault: true,
      label: 'Home',
      phone: '+923001234567',
      recipientName: 'Synthetic Buyer',
      region: 'Punjab',
      userId: buyer.id,
    },
  });
  return { address, buyer, listing, seller };
}

function checkout(listingId: string, addressId: string, idempotencyKey = randomUUID()) {
  return { addressId, idempotencyKey, listingId, paymentMethod: 'CASH_ON_DELIVERY' as const };
}

describe.sequential('trusted communication and commerce PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await clear();
  });
  afterEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('reuses a listing conversation, protects participants, and tracks unread state', async () => {
    const { buyer, listing, seller } = await setup();
    const intruder = await user('outside_user');
    const first = await communication.startConversation(buyer.id, listing.id);
    const second = await communication.startConversation(buyer.id, listing.id);
    expect(second.id).toBe(first.id);
    await expect(communication.startConversation(seller.id, listing.id)).rejects.toMatchObject({
      code: 'CONVERSATION_FORBIDDEN',
    });
    await expect(
      communication.findParticipantConversation(intruder.id, first.id),
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    const sent = await communication.sendMessage(
      buyer.id,
      first.id,
      'Is this jacket true to size?',
      [],
    );
    expect(sent.blocked).toBe(false);
    await expect(
      communication.sendMessage(intruder.id, first.id, 'unauthorized', []),
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    expect((await communication.listConversations(seller.id, 20)).totalUnread).toBe(1);
    await expect(communication.markRead(seller.id, first.id)).resolves.toBe(1);
    expect((await communication.listConversations(seller.id, 20)).totalUnread).toBe(0);
  });

  it('preserves blocked contact-sharing evidence without delivering it', async () => {
    const { buyer, listing } = await setup();
    const conversation = await communication.startConversation(buyer.id, listing.id);
    const detections = detector.inspect('email synthetic at example dot com');
    const result = await communication.sendMessage(
      buyer.id,
      conversation.id,
      'email synthetic at example dot com',
      detections,
    );
    expect(result.blocked).toBe(true);
    await expect(
      prisma.messageModerationFlag.count({
        where: { conversationId: conversation.id, blocked: true },
      }),
    ).resolves.toBeGreaterThan(0);
    await expect(
      prisma.notificationOutbox.count({ where: { messageId: result.message.id } }),
    ).resolves.toBe(0);
  });

  it('allows exactly one concurrent buyer to reserve a single ACTIVE listing', async () => {
    const { address, buyer, listing } = await setup();
    const buyerTwo = await user('race_buyer_two');
    const addressTwo = await prisma.address.create({
      data: {
        addressLine1: '20 Synthetic Street',
        city: 'Karachi',
        countryCode: 'PK',
        label: 'Home',
        phone: '+923001111111',
        recipientName: 'Second Buyer',
        region: 'Sindh',
        userId: buyerTwo.id,
      },
    });
    const results = await Promise.allSettled([
      orders.placeOrder(buyer.id, checkout(listing.id, address.id)),
      orders.placeOrder(buyerTwo.id, checkout(listing.id, addressTwo.id)),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    const persisted = await prisma.order.findMany({ where: { listingId: listing.id } });
    expect(persisted).toHaveLength(1);
    await expect(prisma.listing.findUnique({ where: { id: listing.id } })).resolves.toMatchObject({
      stockAvailable: 0,
      stockReserved: 1,
      status: 'RESERVED',
    });
  });

  it('never reserves more units than a multi-stock listing has available', async () => {
    const { address, buyer, listing } = await setup();
    await prisma.listing.update({ data: { stockAvailable: 3 }, where: { id: listing.id } });
    const otherBuyers = await Promise.all([
      user('stock_buyer_two'),
      user('stock_buyer_three'),
      user('stock_buyer_four'),
    ]);
    const addresses = await Promise.all(
      otherBuyers.map((otherBuyer, index) =>
        prisma.address.create({
          data: {
            addressLine1: `${index + 20} Synthetic Street`,
            city: 'Lahore',
            countryCode: 'PK',
            label: 'Home',
            phone: '+923001234567',
            recipientName: `Synthetic Buyer ${index + 2}`,
            region: 'Punjab',
            userId: otherBuyer.id,
          },
        }),
      ),
    );
    const attempts = [
      orders.placeOrder(buyer.id, checkout(listing.id, address.id)),
      ...otherBuyers.map((otherBuyer, index) =>
        orders.placeOrder(otherBuyer.id, checkout(listing.id, addresses[index]!.id)),
      ),
    ];
    const results = await Promise.allSettled(attempts);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(3);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    await expect(prisma.order.count({ where: { listingId: listing.id } })).resolves.toBe(3);
    await expect(prisma.listing.findUnique({ where: { id: listing.id } })).resolves.toMatchObject({
      stockAvailable: 0,
      stockReserved: 3,
      stockSold: 0,
      status: 'RESERVED',
    });
    await expect(
      prisma.inventoryMovement.count({ where: { listingId: listing.id, type: 'RESERVED' } }),
    ).resolves.toBe(3);
  });

  it('makes checkout retries idempotent and preserves price/address snapshots', async () => {
    const { address, buyer, listing } = await setup();
    const input = checkout(listing.id, address.id);
    const first = await orders.placeOrder(buyer.id, input);
    const retry = await orders.placeOrder(buyer.id, input);
    expect(retry.id).toBe(first.id);
    expect(first.priceMinor).toBe(145_000);
    expect(first.addressLine1).toBe('10 Synthetic Test Street');
    await prisma.address.update({
      data: { addressLine1: 'Changed later' },
      where: { id: address.id },
    });
    await prisma.listing.update({ data: { priceMinor: 999_999 }, where: { id: listing.id } });
    await expect(prisma.order.findUnique({ where: { id: first.id } })).resolves.toMatchObject({
      addressLine1: '10 Synthetic Test Street',
      priceMinor: 145_000,
    });
  });

  it('rolls back reservation and order when the payment provider fails', async () => {
    const { address, buyer, listing } = await setup();
    const failingProvider: PaymentProvider = {
      cancel: () => Promise.reject(new Error('SYNTHETIC_PROVIDER_FAILURE')),
      collect: () => Promise.reject(new Error('SYNTHETIC_PROVIDER_FAILURE')),
      createPayment: () => Promise.reject(new Error('SYNTHETIC_PROVIDER_FAILURE')),
    };
    const failingOrders = new OrderRepository(failingProvider, prisma);
    await expect(
      failingOrders.placeOrder(buyer.id, checkout(listing.id, address.id)),
    ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
    await expect(prisma.order.count({ where: { listingId: listing.id } })).resolves.toBe(0);
    await expect(prisma.listing.findUnique({ where: { id: listing.id } })).resolves.toMatchObject({
      stockAvailable: 1,
      stockReserved: 0,
      status: 'ACTIVE',
    });
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'REMOVED', 'ARCHIVED'] as const)(
    'rejects purchase of %s inventory',
    async (status) => {
      const { address, buyer, listing } = await setup(status);
      await expect(
        orders.placeOrder(buyer.id, checkout(listing.id, address.id)),
      ).rejects.toMatchObject({ code: 'LISTING_NOT_AVAILABLE' });
    },
  );

  it('rejects self purchase and enforces controlled cancellation and completion', async () => {
    const own = await setup();
    await expect(
      orders.placeOrder(own.seller.id, checkout(own.listing.id, own.address.id)),
    ).rejects.toMatchObject({ code: 'SELF_PURCHASE_NOT_ALLOWED' });
    const placed = await orders.placeOrder(own.buyer.id, checkout(own.listing.id, own.address.id));
    await expect(orders.transition(placed.id, own.buyer.id, 'confirm')).rejects.toMatchObject({
      code: 'ORDER_FORBIDDEN',
    });
    await expect(orders.transition(placed.id, own.seller.id, 'confirm')).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
    const operator = await user(`operator_${randomUUID().slice(0, 6)}`);
    await prisma.adminPermissionGrant.create({
      data: { grantedById: operator.id, permission: 'OPERATIONS', userId: operator.id },
    });
    await expect(
      finance.updateShipment(operator.id, placed.id, {
        courierReference: 'SYNTHETIC-LHR-001',
        evidenceReference: 'evidence://synthetic/pickup',
        feeMinor: 25_000,
        status: 'IN_TRANSIT',
      }),
    ).resolves.toMatchObject({ status: 'IN_TRANSIT' });
    await expect(orders.confirmDelivery(placed.id, own.buyer.id)).resolves.toMatchObject({
      status: 'DELIVERED',
    });
    await expect(orders.finalizeDelivered()).resolves.toBe(1);
    await expect(
      prisma.order.findUnique({ include: { payment: true }, where: { id: placed.id } }),
    ).resolves.toMatchObject({ payment: { status: 'PENDING_COLLECTION' }, status: 'COMPLETED' });
    await expect(
      prisma.listing.findUnique({ where: { id: own.listing.id } }),
    ).resolves.toMatchObject({ stockAvailable: 0, stockReserved: 0, stockSold: 1, status: 'SOLD' });
  });

  it('cancels idempotently and only releases the matching reservation', async () => {
    const { address, buyer, listing } = await setup();
    const placed = await orders.placeOrder(buyer.id, checkout(listing.id, address.id));
    const cancelled = await orders.transition(
      placed.id,
      buyer.id,
      'cancelBuyer',
      'Changed my mind safely',
    );
    expect(cancelled.status).toBe('CANCELLED');
    await expect(
      orders.transition(placed.id, buyer.id, 'cancelBuyer', 'Retry'),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(prisma.listing.findUnique({ where: { id: listing.id } })).resolves.toMatchObject({
      stockAvailable: 1,
      stockReserved: 0,
      status: 'ACTIVE',
    });
  });

  it('materializes notifications once, enforces ownership, and retries push independently', async () => {
    const recipient = await user('notification_recipient');
    const actor = await user('notification_actor');
    const outsider = await user('notification_outsider');
    await prisma.pushDevice.create({
      data: {
        expoPushToken: 'ExpoPushToken[SyntheticDeviceToken123]',
        platform: 'ANDROID',
        userId: recipient.id,
      },
    });
    const outbox = await prisma.notificationOutbox.create({
      data: {
        actorUserId: actor.id,
        dedupeKey: `test:${randomUUID()}`,
        eventType: 'NEW_FOLLOWER',
        recipientId: recipient.id,
      },
    });
    fakePush.failNext = true;
    await notificationWorker.tick();
    await expect(prisma.notification.count({ where: { recipientId: recipient.id } })).resolves.toBe(
      1,
    );
    await expect(
      prisma.notificationOutbox.findUnique({ where: { id: outbox.id } }),
    ).resolves.toMatchObject({ status: 'PENDING' });
    await prisma.notificationOutbox.update({
      data: { availableAt: new Date(0) },
      where: { id: outbox.id },
    });
    await notificationWorker.tick();
    await notificationWorker.tick();
    await expect(
      prisma.notification.count({ where: { dedupeKey: outbox.dedupeKey } }),
    ).resolves.toBe(1);
    await expect(prisma.pushDelivery.count()).resolves.toBe(1);
    const notification = await prisma.notification.findUniqueOrThrow({
      where: { dedupeKey: outbox.dedupeKey },
    });
    await expect(
      notificationRepository.markRead(outsider.id, notification.id),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    await expect(
      notificationRepository.markRead(recipient.id, notification.id),
    ).resolves.toBeUndefined();
    const device = await prisma.pushDevice.findFirstOrThrow({ where: { userId: recipient.id } });
    await notificationRepository.deactivateDevice(recipient.id, device.id);
    await expect(prisma.pushDevice.findUnique({ where: { id: device.id } })).resolves.toMatchObject(
      { active: false },
    );
  });
});
