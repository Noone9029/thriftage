import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { getPrismaClient, Prisma, type PrismaClient } from '@thriftage/db';
import type { CheckoutInput, OrderQuery } from '@thriftage/shared';
import { loadApiConfig } from '@thriftage/config/api';

import { CommerceDomainError } from './commerce.errors';
import { transitionOrder, type OrderActor } from './order-state-machine';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.interface';
import { calculateOrderFinancialSnapshot } from './financial-policy';

export const orderArgs = {
  include: {
    buyer: { include: { profile: true } },
    events: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
    payment: true,
    seller: { include: { profile: true } },
    shipment: true,
  },
} as const satisfies Prisma.OrderDefaultArgs;

export type OrderRecord = Prisma.OrderGetPayload<typeof orderArgs>;

function orderNumber(orderId: string): string {
  return `THR-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 8).toUpperCase()}`;
}

function notificationData(input: {
  actorUserId: string;
  dedupeKey: string;
  eventType: Prisma.NotificationOutboxUncheckedCreateInput['eventType'];
  listingId: string;
  orderId: string;
  recipientId: string;
}) {
  return { ...input, status: 'PENDING' as const };
}

@Injectable()
export class OrderRepository {
  public constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly prisma?: PrismaClient,
  ) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async placeOrder(buyerId: string, input: CheckoutInput): Promise<OrderRecord> {
    const existing = await this.client.order.findUnique({
      ...orderArgs,
      where: { buyerId_idempotencyKey: { buyerId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing !== null) return existing;

    try {
      return await this.client.$transaction(
        async (transaction) => {
          const retry = await transaction.order.findUnique({
            ...orderArgs,
            where: { buyerId_idempotencyKey: { buyerId, idempotencyKey: input.idempotencyKey } },
          });
          if (retry !== null) return retry;

          const locked = await transaction.$queryRaw<readonly { id: string }[]>(Prisma.sql`
          SELECT id FROM listings
          WHERE id = ${input.listingId}::uuid AND status = 'ACTIVE'::"ListingStatus" AND stock_available > 0
          FOR UPDATE
        `);
          if (locked.length !== 1) throw new CommerceDomainError('LISTING_NOT_AVAILABLE');

          const listing = await transaction.listing.findUnique({
            include: {
              images: { orderBy: { position: 'asc' }, take: 1 },
              seller: { include: { profile: true } },
            },
            where: { id: input.listingId },
          });
          if (listing === null || listing.status !== 'ACTIVE' || listing.stockAvailable < 1)
            throw new CommerceDomainError('LISTING_NOT_AVAILABLE');
          if (listing.sellerId === buyerId)
            throw new CommerceDomainError('SELF_PURCHASE_NOT_ALLOWED');

          const buyer = await transaction.user.findUnique({
            include: { profile: true },
            where: { id: buyerId },
          });
          const address = await transaction.address.findFirst({
            where: { id: input.addressId, userId: buyerId },
          });
          if (buyer?.profile === null || buyer === null)
            throw new CommerceDomainError('ORDER_FORBIDDEN');
          if (address === null) throw new CommerceDomainError('ADDRESS_NOT_FOUND');
          if (listing.seller.profile === null)
            throw new CommerceDomainError('LISTING_NOT_AVAILABLE');

          const id = randomUUID();
          const config = loadApiConfig(process.env);
          if (!config.localCourierEnabled) {
            throw new CommerceDomainError('PAYMENT_METHOD_DISABLED');
          }
          const deliveryCityEligible = config.localCourierServiceCities.some(
            (city) => city.localeCompare(address.city, undefined, { sensitivity: 'accent' }) === 0,
          );
          if (
            address.countryCode.toUpperCase() !== config.localCourierServiceCountryCode ||
            !deliveryCityEligible
          ) {
            throw new CommerceDomainError('ADDRESS_INVALID');
          }
          const shippingMinor = config.lahoreDeliveryFeeMinor;
          const financial = calculateOrderFinancialSnapshot({
            itemSubtotalMinor: listing.priceMinor,
            shippingMinor,
            withholdingBps: config.withholdingBps,
            withholdingRuleVersion: config.withholdingRuleVersion,
          });
          const paymentExpiresAt =
            input.paymentMethod === 'PAYFAST_HOSTED'
              ? new Date(Date.now() + config.paymentExpiryMinutes * 60_000)
              : null;
          const payment = await this.paymentProvider
            .createPayment({
              amountMinor: financial.totalMinor,
              currency: listing.currency,
              method: input.paymentMethod,
              orderId: id,
            })
            .catch(() => {
              throw new CommerceDomainError('PAYMENT_PROVIDER_UNAVAILABLE');
            });
          const conversation = await transaction.conversation.upsert({
            create: { buyerId, listingId: listing.id, sellerId: listing.sellerId },
            update: {},
            where: { listingId_buyerId: { buyerId, listingId: listing.id } },
          });
          const order = await transaction.order.create({
            ...orderArgs,
            data: {
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              buyerId,
              buyerUsername: buyer.profile.username,
              city: address.city,
              conversationId: conversation.id,
              countryCode: address.countryCode,
              deliveryInstructions: address.deliveryInstructions,
              deliveryPhone: address.phone,
              deliveryRateVersion: config.lahoreDeliveryRateVersion,
              events: {
                create: {
                  actorId: buyerId,
                  actorType: 'USER',
                  nextState:
                    input.paymentMethod === 'PAYFAST_HOSTED' ? 'AWAITING_PAYMENT' : 'PENDING',
                  type: 'ORDER_CREATED',
                },
              },
              id,
              idempotencyKey: input.idempotencyKey,
              listingId: listing.id,
              listingImageKey: listing.images[0]?.storageKey ?? null,
              listingTitle: listing.title,
              orderNumber: orderNumber(id),
              payment: {
                create: {
                  amountMinor: financial.totalMinor,
                  ...(payment.checkoutUrl === undefined
                    ? {}
                    : { checkoutUrl: payment.checkoutUrl }),
                  currency: listing.currency,
                  expiresAt: payment.expiresAt ?? paymentExpiresAt,
                  method: input.paymentMethod,
                  provider: payment.provider,
                  providerReference: payment.providerReference,
                  status: payment.status,
                },
              },
              paymentMethod: input.paymentMethod,
              paymentExpiresAt,
              postalCode: address.postalCode,
              priceMinor: listing.priceMinor,
              quantity: financial.quantity,
              itemSubtotalMinor: financial.itemSubtotalMinor,
              commissionBps: financial.commissionBps,
              commissionMinor: financial.commissionMinor,
              withholdingBps: financial.withholdingBps,
              withholdingMinor: financial.withholdingMinor,
              sellerNetMinor: financial.sellerNetMinor,
              financialPolicyVersion: financial.financialPolicyVersion,
              withholdingRuleVersion: financial.withholdingRuleVersion,
              recipientName: address.recipientName,
              region: address.region,
              sellerId: listing.sellerId,
              sellerUsername: listing.seller.profile.username,
              shippingMinor,
              status: input.paymentMethod === 'PAYFAST_HOSTED' ? 'AWAITING_PAYMENT' : 'PENDING',
              totalMinor: financial.totalMinor,
              currency: listing.currency,
            },
          });
          const availableAfter = listing.stockAvailable - 1;
          const reservedAfter = listing.stockReserved + 1;
          const reserved = await transaction.listing.updateMany({
            data: {
              stockAvailable: availableAfter,
              stockReserved: reservedAfter,
              status: availableAfter > 0 ? 'ACTIVE' : 'RESERVED',
            },
            where: { id: listing.id, stockAvailable: listing.stockAvailable, status: 'ACTIVE' },
          });
          if (reserved.count !== 1) throw new CommerceDomainError('LISTING_NOT_AVAILABLE');
          await transaction.inventoryMovement.create({
            data: {
              actorId: buyerId,
              availableAfter,
              listingId: listing.id,
              orderId: id,
              quantity: 1,
              reservedAfter,
              soldAfter: listing.stockSold,
              type: 'RESERVED',
            },
          });
          await transaction.notificationOutbox.create({
            data: notificationData({
              actorUserId: buyerId,
              dedupeKey: `order:${id}:created:seller`,
              eventType: 'ITEM_PURCHASED',
              listingId: listing.id,
              orderId: id,
              recipientId: listing.sellerId,
            }),
          });
          return order;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
      );
    } catch (error: unknown) {
      if (error instanceof CommerceDomainError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new CommerceDomainError('LISTING_NOT_AVAILABLE');
      }
      throw error;
    }
  }

  public findParticipant(userId: string, orderId: string): Promise<OrderRecord | null> {
    return this.client.order.findFirst({
      ...orderArgs,
      where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    });
  }

  public findAdmin(orderId: string): Promise<OrderRecord | null> {
    return this.client.order.findUnique({ ...orderArgs, where: { id: orderId } });
  }

  public async listParticipant(
    userId: string,
    role: 'buyer' | 'seller',
    query: OrderQuery,
    cursor?: { readonly createdAt: Date; readonly id: string },
  ) {
    const records = await this.client.order.findMany({
      ...orderArgs,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        ...(role === 'buyer' ? { buyerId: userId } : { sellerId: userId }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(cursor === undefined
          ? {}
          : {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ],
            }),
      },
    });
    return { hasMore: records.length > query.limit, records: records.slice(0, query.limit) };
  }

  public async listAdmin(
    query: OrderQuery & { q?: string | undefined },
    cursor?: { readonly createdAt: Date; readonly id: string },
  ) {
    const records = await this.client.order.findMany({
      ...orderArgs,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(cursor === undefined
          ? {}
          : {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ],
            }),
        ...(query.q === undefined
          ? {}
          : {
              OR: [
                { orderNumber: { contains: query.q, mode: 'insensitive' } },
                { listingTitle: { contains: query.q, mode: 'insensitive' } },
                { buyerUsername: { contains: query.q, mode: 'insensitive' } },
                { sellerUsername: { contains: query.q, mode: 'insensitive' } },
              ],
            }),
      },
    });
    return { hasMore: records.length > query.limit, records: records.slice(0, query.limit) };
  }

  private async lockOrder(
    transaction: Prisma.TransactionClient,
    orderId: string,
  ): Promise<OrderRecord> {
    await transaction.$queryRaw(
      Prisma.sql`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`,
    );
    const order = await transaction.order.findUnique({ ...orderArgs, where: { id: orderId } });
    if (order === null) throw new CommerceDomainError('ORDER_NOT_FOUND');
    return order;
  }

  public transition(
    orderId: string,
    actorId: string,
    action: 'confirm' | 'cancelBuyer' | 'cancelSeller',
    reason?: string,
  ): Promise<OrderRecord> {
    return this.client.$transaction(async (transaction) => {
      const order = await this.lockOrder(transaction, orderId);
      const actor: OrderActor = action === 'cancelBuyer' ? 'BUYER' : 'SELLER';
      if ((actor === 'BUYER' ? order.buyerId : order.sellerId) !== actorId)
        throw new CommerceDomainError('ORDER_FORBIDDEN');
      if (action === 'confirm' && order.status === 'CONFIRMED') return order;
      if (action !== 'confirm' && order.status === 'CANCELLED') return order;
      const isCancel = action !== 'confirm';
      const next = transitionOrder(order.status, isCancel ? 'CANCEL' : 'CONFIRM', actor);
      const now = new Date();
      if (isCancel) {
        if (order.payment?.status === 'COLLECTED') {
          await transaction.refund.upsert({
            create: {
              amountMinor: order.totalMinor,
              commissionReversalMinor: order.commissionMinor,
              orderId,
              paymentId: order.payment.id,
              reason: `VALID_CANCELLATION: ${reason ?? 'Order cancelled before shipment.'}`,
              requestedById: actorId,
            },
            update: {},
            where: { orderId },
          });
          await transaction.payment.update({
            data: { status: 'REFUND_PENDING' },
            where: { orderId },
          });
        } else {
          await this.paymentProvider
            .cancel({ method: order.paymentMethod, paymentId: order.payment?.id ?? '', orderId })
            .catch(() => {
              throw new CommerceDomainError('PAYMENT_PROVIDER_UNAVAILABLE');
            });
          await transaction.payment.update({ data: { status: 'CANCELLED' }, where: { orderId } });
        }
        await transaction.shipment.updateMany({
          data: { status: 'CANCELLED' },
          where: { orderId },
        });
        const listing = await transaction.listing.findUnique({ where: { id: order.listingId } });
        if (listing === null || listing.stockReserved < 1)
          throw new CommerceDomainError('LISTING_NOT_AVAILABLE');
        const availableAfter = listing.stockAvailable + 1;
        const reservedAfter = listing.stockReserved - 1;
        await transaction.listing.update({
          data: { stockAvailable: availableAfter, stockReserved: reservedAfter, status: 'ACTIVE' },
          where: { id: listing.id },
        });
        await transaction.inventoryMovement.create({
          data: {
            actorId,
            availableAfter,
            listingId: listing.id,
            orderId,
            quantity: 1,
            reason: reason ?? 'Order cancelled before shipment.',
            reservedAfter,
            soldAfter: listing.stockSold,
            type: 'RELEASED',
          },
        });
      }
      await transaction.orderEvent.create({
        data: {
          actorId,
          actorType: 'USER',
          nextState: next,
          orderId,
          previousState: order.status,
          ...(reason === undefined ? {} : { reason }),
          type: isCancel
            ? actor === 'BUYER'
              ? 'BUYER_CANCELLED'
              : 'SELLER_CANCELLED'
            : 'SELLER_CONFIRMED',
        },
      });
      await transaction.notificationOutbox.create({
        data: notificationData({
          actorUserId: actorId,
          dedupeKey: `order:${orderId}:${next.toLowerCase()}`,
          eventType: isCancel ? 'ORDER_CANCELLED' : 'ORDER_CONFIRMED',
          listingId: order.listingId,
          orderId,
          recipientId: actor === 'BUYER' ? order.sellerId : order.buyerId,
        }),
      });
      await transaction.order.update({
        data: isCancel
          ? {
              cancellationReason: reason ?? null,
              cancelledAt: now,
              cancelledById: actorId,
              status: next,
            }
          : { confirmedAt: now, status: next },
        where: { id: orderId },
      });
      return this.lockOrder(transaction, orderId);
    });
  }

  public confirmDelivery(orderId: string, buyerId: string): Promise<OrderRecord> {
    return this.client.$transaction(async (transaction) => {
      const order = await this.lockOrder(transaction, orderId);
      if (order.buyerId !== buyerId) throw new CommerceDomainError('ORDER_FORBIDDEN');
      if (order.status === 'DELIVERED' || order.status === 'COMPLETED') return order;
      const next = transitionOrder(order.status, 'CONFIRM_DELIVERY', 'BUYER');
      const now = new Date();
      await transaction.shipment.update({
        data: { deliveredAt: now, status: 'DELIVERED' },
        where: { orderId },
      });
      await transaction.orderEvent.create({
        data: {
          actorId: buyerId,
          actorType: 'USER',
          nextState: next,
          orderId,
          previousState: order.status,
          type: 'MARKED_DELIVERED',
        },
      });
      await transaction.notificationOutbox.create({
        data: notificationData({
          actorUserId: buyerId,
          dedupeKey: `order:${orderId}:delivered`,
          eventType: 'ORDER_DELIVERED',
          listingId: order.listingId,
          orderId,
          recipientId: order.sellerId,
        }),
      });
      return transaction.order.update({
        ...orderArgs,
        data: {
          deliveredAt: now,
          disputeWindowEndsAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          status: next,
        },
        where: { id: orderId },
      });
    });
  }

  public async finalizeDelivered(limit = 25): Promise<number> {
    const candidates = await this.client.order.findMany({
      select: { id: true },
      take: limit,
      where: { status: 'DELIVERED' },
    });
    let completed = 0;
    for (const candidate of candidates) {
      const didComplete = await this.client.$transaction(async (transaction) => {
        const order = await this.lockOrder(transaction, candidate.id);
        if (order.status !== 'DELIVERED' || order.payment === null) return false;
        const next = transitionOrder(order.status, 'COMPLETE', 'SYSTEM');
        const now = new Date();
        await transaction.orderEvent.create({
          data: {
            actorType: 'SYSTEM',
            nextState: next,
            orderId: order.id,
            previousState: order.status,
            type: 'COMPLETED',
          },
        });
        const disputeWindowEndsAt =
          order.disputeWindowEndsAt ?? new Date(now.getTime() + 48 * 60 * 60 * 1000);
        await transaction.order.update({
          data: {
            completedAt: now,
            disputeWindowEndsAt,
            payoutEligibleAt: disputeWindowEndsAt,
            status: next,
          },
          where: { id: order.id },
        });
        const listing = await transaction.listing.findUnique({ where: { id: order.listingId } });
        if (listing === null || listing.stockReserved < 1) return false;
        const reservedAfter = listing.stockReserved - 1;
        const soldAfter = listing.stockSold + 1;
        const status =
          listing.stockAvailable > 0 ? 'ACTIVE' : reservedAfter > 0 ? 'RESERVED' : 'SOLD';
        await transaction.listing.update({
          data: { stockReserved: reservedAfter, stockSold: soldAfter, status },
          where: { id: listing.id },
        });
        await transaction.inventoryMovement.create({
          data: {
            availableAfter: listing.stockAvailable,
            listingId: listing.id,
            orderId: order.id,
            quantity: 1,
            reservedAfter,
            soldAfter,
            type: 'SOLD',
          },
        });
        await transaction.financialEntry.createMany({
          data: [
            {
              amountMinor: order.commissionMinor,
              currency: order.currency,
              occurredAt: now,
              orderId: order.id,
              ruleVersion: order.financialPolicyVersion,
              type: 'COMMISSION',
            },
            ...(order.withholdingMinor === 0
              ? []
              : [
                  {
                    amountMinor: order.withholdingMinor,
                    currency: order.currency,
                    occurredAt: now,
                    orderId: order.id,
                    ruleVersion: order.withholdingRuleVersion,
                    type: 'WITHHOLDING' as const,
                  },
                ]),
            {
              amountMinor: order.sellerNetMinor,
              currency: order.currency,
              occurredAt: now,
              orderId: order.id,
              ruleVersion: order.financialPolicyVersion,
              type: 'SELLER_PAYABLE',
            },
          ],
        });
        await transaction.profile.updateMany({
          data: { completedSalesCount: { increment: 1 } },
          where: { userId: order.sellerId },
        });
        await transaction.notificationOutbox.createMany({
          data: [
            notificationData({
              actorUserId: order.sellerId,
              dedupeKey: `order:${order.id}:completed:buyer`,
              eventType: 'ORDER_COMPLETED',
              listingId: order.listingId,
              orderId: order.id,
              recipientId: order.buyerId,
            }),
            notificationData({
              actorUserId: order.buyerId,
              dedupeKey: `order:${order.id}:sold:seller`,
              eventType: 'ITEM_SOLD',
              listingId: order.listingId,
              orderId: order.id,
              recipientId: order.sellerId,
            }),
          ],
        });
        return true;
      });
      if (didComplete) completed += 1;
    }
    return completed;
  }
}
