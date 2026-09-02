import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import { getPrismaClient, Prisma, type PrismaClient } from '@thriftage/db';

import { CommerceDomainError } from './commerce.errors';
import {
  PAYFAST_GATEWAY,
  type PayFastGateway,
  type PayFastGatewayEvent,
} from './payfast-gateway.interface';

@Injectable()
export class PayFastPaymentService {
  public constructor(
    @Inject(PAYFAST_GATEWAY) private readonly gateway: PayFastGateway,
    private readonly prisma?: PrismaClient,
  ) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async checkout(buyerId: string, orderId: string) {
    if (!loadApiConfig(process.env).payfastEnabled) {
      throw new CommerceDomainError('PAYMENT_METHOD_DISABLED');
    }
    const order = await this.client.order.findFirst({
      include: { buyer: true, payment: true },
      where: { buyerId, id: orderId },
    });
    if (order?.payment === null || order === null) throw new CommerceDomainError('ORDER_NOT_FOUND');
    if (order.status !== 'AWAITING_PAYMENT' || order.payment.provider !== 'PAYFAST') {
      throw new CommerceDomainError('ORDER_INVALID_TRANSITION');
    }
    if (order.paymentExpiresAt === null || order.paymentExpiresAt.getTime() <= Date.now()) {
      throw new CommerceDomainError('PAYMENT_FAILED');
    }
    if (order.buyer.email === null || order.buyer.phone === null) {
      throw new CommerceDomainError('ORDER_FORBIDDEN');
    }
    if (
      order.payment.checkoutUrl !== null &&
      order.payment.expiresAt !== null &&
      order.payment.expiresAt.getTime() > Date.now() &&
      order.payment.providerReference !== null &&
      !order.payment.providerReference.startsWith('payfast:pending:')
    ) {
      return {
        expiresAt: order.payment.expiresAt,
        redirectUrl: order.payment.checkoutUrl,
      };
    }
    const session = await this.gateway.createHostedSession({
      amountMinor: order.totalMinor,
      currency: order.currency,
      customerEmail: order.buyer.email,
      customerPhone: order.buyer.phone,
      idempotencyKey: order.id,
      orderId,
    });
    if (
      session.providerReference.trim() === '' ||
      session.expiresAt.getTime() <= Date.now() ||
      session.expiresAt.getTime() > order.paymentExpiresAt.getTime()
    ) {
      throw new CommerceDomainError('PAYMENT_STATUS_MISMATCH');
    }
    const updated = await this.client.payment.updateMany({
      data: {
        checkoutUrl: session.redirectUrl,
        expiresAt: session.expiresAt,
        providerReference: session.providerReference,
      },
      where: {
        id: order.payment.id,
        order: { status: 'AWAITING_PAYMENT' },
        status: 'REQUIRES_ACTION',
      },
    });
    if (updated.count !== 1) throw new CommerceDomainError('ORDER_INVALID_TRANSITION');
    return { expiresAt: session.expiresAt, redirectUrl: session.redirectUrl };
  }

  public async callback(rawBody: Buffer, signature: string): Promise<void> {
    let callback: PayFastGatewayEvent;
    try {
      callback = await this.gateway.verifyCallback(rawBody, signature);
    } catch {
      throw new CommerceDomainError('PAYMENT_SIGNATURE_INVALID');
    }
    const authoritative = await this.gateway
      .getAuthoritativeStatus(callback.providerReference)
      .catch(() => {
        throw new CommerceDomainError('PAYMENT_PROVIDER_UNAVAILABLE');
      });
    if (
      authoritative.orderId !== callback.orderId ||
      authoritative.amountMinor !== callback.amountMinor ||
      authoritative.currency !== callback.currency ||
      authoritative.status !== callback.status
    ) {
      throw new CommerceDomainError('PAYMENT_STATUS_MISMATCH');
    }
    await this.applyStatus(authoritative, createHash('sha256').update(rawBody).digest('hex'));
  }

  public async status(userId: string, orderId: string) {
    const order = await this.client.order.findFirst({
      include: { payment: true },
      where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    });
    if (order?.payment === null || order === null || order.payment.provider !== 'PAYFAST') {
      throw new CommerceDomainError('ORDER_NOT_FOUND');
    }
    if (order.payment.providerReference === null) throw new CommerceDomainError('PAYMENT_FAILED');
    const status = await this.gateway
      .getAuthoritativeStatus(order.payment.providerReference)
      .catch(() => {
        throw new CommerceDomainError('PAYMENT_PROVIDER_UNAVAILABLE');
      });
    await this.applyStatus(
      status,
      createHash('sha256').update(`status:${status.eventId}`).digest('hex'),
    );
    return { orderId, status: status.status };
  }

  private async applyStatus(event: PayFastGatewayEvent, payloadHash: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM orders WHERE id = ${event.orderId}::uuid FOR UPDATE`,
      );
      const order = await transaction.order.findUnique({
        include: { payment: true },
        where: { id: event.orderId },
      });
      if (order?.payment === null || order === null || order.payment.provider !== 'PAYFAST') {
        throw new CommerceDomainError('ORDER_NOT_FOUND');
      }
      if (order.totalMinor !== event.amountMinor || order.currency !== event.currency) {
        throw new CommerceDomainError('PAYMENT_STATUS_MISMATCH');
      }
      if (order.payment.providerReference !== event.providerReference) {
        throw new CommerceDomainError('PAYMENT_STATUS_MISMATCH');
      }
      const duplicate = await transaction.paymentProviderEvent.findUnique({
        where: { providerEventId: event.eventId },
      });
      if (duplicate !== null) return;
      await transaction.paymentProviderEvent.create({
        data: {
          eventType: event.status,
          payloadHash,
          paymentId: order.payment.id,
          providerEventId: event.eventId,
        },
      });
      if (event.status === 'PENDING') return;
      if (event.status === 'PAID') {
        await transaction.payment.update({
          data: {
            collectedAt: new Date(),
            providerReference: event.providerReference,
            status: 'COLLECTED',
          },
          where: { id: order.payment.id },
        });
        if (order.status === 'AWAITING_PAYMENT') {
          await transaction.order.update({ data: { status: 'PENDING' }, where: { id: order.id } });
          await transaction.orderEvent.create({
            data: {
              actorType: 'SYSTEM',
              nextState: 'PENDING',
              orderId: order.id,
              previousState: 'AWAITING_PAYMENT',
              type: 'PAYMENT_STATUS_CHANGED',
            },
          });
        }
        return;
      }
      if (order.status !== 'AWAITING_PAYMENT')
        throw new CommerceDomainError('PAYMENT_STATUS_MISMATCH');
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
          availableAfter,
          listingId: listing.id,
          orderId: order.id,
          quantity: 1,
          reason: `PayFast ${event.status.toLowerCase()}.`,
          reservedAfter,
          soldAfter: listing.stockSold,
          type: 'RELEASED',
        },
      });
      await transaction.payment.update({
        data: {
          failureCode: event.status,
          providerReference: event.providerReference,
          status: event.status === 'FAILED' ? 'FAILED' : 'CANCELLED',
        },
        where: { id: order.payment.id },
      });
      await transaction.order.update({
        data: {
          cancelledAt: new Date(),
          cancellationReason: `PayFast ${event.status.toLowerCase()}.`,
          status: 'CANCELLED',
        },
        where: { id: order.id },
      });
      await transaction.orderEvent.create({
        data: {
          actorType: 'SYSTEM',
          nextState: 'CANCELLED',
          orderId: order.id,
          previousState: 'AWAITING_PAYMENT',
          type: event.status === 'FAILED' ? 'PAYMENT_STATUS_CHANGED' : 'PAYMENT_EXPIRED',
        },
      });
    });
  }

  public async expireDue(limit = 25): Promise<number> {
    const due = await this.client.order.findMany({
      include: { payment: true },
      take: limit,
      where: {
        paymentExpiresAt: { lte: new Date() },
        paymentMethod: 'PAYFAST_HOSTED',
        status: 'AWAITING_PAYMENT',
      },
    });
    let expired = 0;
    for (const order of due) {
      const reference = order.payment?.providerReference;
      if (reference === undefined || reference === null) continue;
      try {
        const status = await this.gateway.getAuthoritativeStatus(reference);
        await this.applyStatus(
          status.status === 'PENDING'
            ? {
                ...status,
                eventId: `expiry:${order.id}:${order.paymentExpiresAt?.toISOString() ?? ''}`,
                status: 'CANCELLED',
              }
            : status,
          createHash('sha256').update(`expiry:${order.id}`).digest('hex'),
        );
        expired += 1;
      } catch {
        // Fail closed: a provider outage must retain the reservation for manual reconciliation.
      }
    }
    return expired;
  }
}
