import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import {
  getPrismaClient,
  Prisma,
  type PrismaClient,
  type ShipmentStatus,
  type User,
} from '@thriftage/db';
import type {
  PayoutBatchCreateInput,
  PayoutBatchPaidInput,
  PayoutProfileReviewInput,
  RefundDecisionInput,
  RefundRequestInput,
  SellerPayoutProfileInput,
  SettlementInput,
  AdminShipmentInput,
  CommerceMetrics,
  CommerceMetricsQuery,
  SellerStatementEntry,
} from '@thriftage/shared';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CommerceDomainError } from './commerce.errors';

const OPEN_DISPUTE_STATES = ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'] as const;

const SHIPMENT_TRANSITIONS: Readonly<
  Record<ShipmentStatus | 'NONE', readonly AdminShipmentInput['status'][]>
> = {
  NONE: ['BOOKED'],
  PENDING: ['BOOKED'],
  BOOKED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED', 'RETURNING', 'LOST'],
  IN_TRANSIT: ['DELIVERED', 'FAILED', 'RETURNING', 'LOST'],
  SHIPPED: ['DELIVERED', 'FAILED', 'RETURNING', 'LOST'],
  DELIVERED: ['RETURNING'],
  FAILED: ['RETURNING', 'RETURNED'],
  RETURNING: ['RETURNED', 'LOST'],
  RETURNED: [],
  LOST: [],
  CANCELLED: [],
};

export function canTransitionShipment(
  previous: ShipmentStatus | null,
  next: AdminShipmentInput['status'],
): boolean {
  if (previous === next) return true;
  return SHIPMENT_TRANSITIONS[previous ?? 'NONE'].includes(next);
}

export interface FinanceStatusResult {
  readonly id: string;
  readonly status: string;
}

export interface RefundStatusResult extends FinanceStatusResult {
  readonly amountMinor: number;
}

export interface PayoutBatchResult extends FinanceStatusResult {
  readonly totalMinor: number;
}

function normalizeDestination(type: SellerPayoutProfileInput['type'], destination: string): string {
  return type === 'BANK_IBAN'
    ? destination.replaceAll(' ', '').toUpperCase()
    : destination.replace(/[\s-]/g, '');
}

function displayLabel(type: SellerPayoutProfileInput['type'], destination: string): string {
  const suffix = destination.slice(-4);
  return type === 'BANK_IBAN'
    ? `IBAN ending ${suffix}`
    : `${type === 'EASYPAISA' ? 'Easypaisa' : 'JazzCash'} ending ${suffix}`;
}

function serializeProfile(profile: {
  accountTitle: string;
  createdAt: Date;
  displayLabel: string;
  heldUntil: Date;
  id: string;
  status: string;
  type: string;
  updatedAt: Date;
}) {
  return {
    accountTitle: profile.accountTitle,
    createdAt: profile.createdAt.toISOString(),
    displayLabel: profile.displayLabel,
    heldUntil: profile.heldUntil.toISOString(),
    id: profile.id,
    status: profile.status,
    type: profile.type,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

@Injectable()
export class FinanceService {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  private encryptionKey(): Buffer {
    const encoded = loadApiConfig(process.env).payoutEncryptionKey;
    if (encoded === undefined) throw new CommerceDomainError('PAYOUT_DESTINATION_INVALID');
    const key = Buffer.from(encoded, 'base64url');
    if (key.length !== 32) throw new CommerceDomainError('PAYOUT_DESTINATION_INVALID');
    return key;
  }

  private assertRecentAuthentication(context: AuthenticatedRequestContext): void {
    const issuedAt = context.identity.issuedAt;
    const maxAge = loadApiConfig(process.env).accountDeletionReauthMaxAgeSeconds * 1_000;
    if (
      issuedAt === undefined ||
      Date.now() - issuedAt.getTime() > maxAge ||
      issuedAt.getTime() > Date.now() + 60_000
    ) {
      throw new CommerceDomainError('PAYOUT_DESTINATION_INVALID');
    }
  }

  private assertPayoutsEnabled(): void {
    if (!loadApiConfig(process.env).payoutsEnabled) {
      throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
    }
  }

  private async requirePermission(
    adminId: string,
    permission: 'FINANCE_RECONCILIATION' | 'OPERATIONS' | 'PAYOUT_APPROVE' | 'PAYOUT_CREATE',
  ): Promise<void> {
    const grant = await this.client.adminPermissionGrant.findUnique({
      where: { userId_permission: { permission, userId: adminId } },
    });
    if (grant === null) throw new CommerceDomainError('ORDER_FORBIDDEN');
  }

  public async createPayoutProfile(
    seller: User,
    context: AuthenticatedRequestContext,
    input: SellerPayoutProfileInput,
  ) {
    this.assertPayoutsEnabled();
    this.assertRecentAuthentication(context);
    if (!seller.phoneVerified || seller.phone === null) {
      throw new CommerceDomainError('PAYOUT_DESTINATION_INVALID');
    }
    const destination = normalizeDestination(input.type, input.destination);
    if (input.type !== 'BANK_IBAN' && destination !== seller.phone) {
      throw new CommerceDomainError('PAYOUT_DESTINATION_INVALID');
    }
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(destination, 'utf8'), cipher.final()]);
    const heldUntil = new Date(Date.now() + 72 * 60 * 60 * 1_000);
    const profile = await this.client.$transaction(async (transaction) => {
      const created = await transaction.sellerPayoutProfile.create({
        data: {
          accountTitle: input.accountTitle,
          destinationAuthTag: cipher.getAuthTag().toString('base64url'),
          destinationCiphertext: ciphertext.toString('base64url'),
          destinationFingerprint: createHmac('sha256', key).update(destination).digest('hex'),
          destinationIv: iv.toString('base64url'),
          displayLabel: displayLabel(input.type, destination),
          heldUntil,
          sellerId: seller.id,
          type: input.type,
        },
      });
      await transaction.notificationOutbox.create({
        data: {
          dedupeKey: `payout-profile:${created.id}:submitted`,
          eventType: 'PAYOUT_DESTINATION_CHANGED',
          recipientId: seller.id,
        },
      });
      return created;
    });
    return serializeProfile(profile);
  }

  public async listPayoutProfiles(sellerId: string) {
    const profiles = await this.client.sellerPayoutProfile.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: { sellerId },
    });
    return profiles.map(serializeProfile);
  }

  public async reviewPayoutProfile(
    adminId: string,
    profileId: string,
    input: PayoutProfileReviewInput,
  ) {
    this.assertPayoutsEnabled();
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    return this.client.$transaction(async (transaction) => {
      const profile = await transaction.sellerPayoutProfile.findUnique({
        where: { id: profileId },
      });
      if (profile === null || profile.status !== 'PENDING_REVIEW') {
        throw new CommerceDomainError('PAYOUT_DESTINATION_INVALID');
      }
      if (input.approve && profile.heldUntil.getTime() > Date.now()) {
        throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
      }
      if (input.approve) {
        await transaction.sellerPayoutProfile.updateMany({
          data: { status: 'SUPERSEDED' },
          where: { sellerId: profile.sellerId, status: 'ACTIVE' },
        });
      }
      const reviewed = await transaction.sellerPayoutProfile.update({
        data: {
          reviewReason: input.reason,
          reviewedAt: new Date(),
          reviewedById: adminId,
          status: input.approve ? 'ACTIVE' : 'REJECTED',
        },
        where: { id: profileId },
      });
      return serializeProfile(reviewed);
    });
  }

  public async sellerStatement(sellerId: string): Promise<readonly SellerStatementEntry[]> {
    const entries = await this.client.financialEntry.findMany({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 250,
      where: { order: { sellerId } },
    });
    return entries.map((entry) => ({
      amountMinor: entry.amountMinor,
      createdAt: entry.occurredAt.toISOString(),
      currency: entry.currency,
      id: entry.id,
      orderId: entry.orderId,
      type: entry.type,
    }));
  }

  public async recordSettlement(
    adminId: string,
    input: SettlementInput,
  ): Promise<FinanceStatusResult> {
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    const duplicate = await this.client.settlement.findUnique({
      include: { allocations: true },
      where: {
        source_externalReference: {
          externalReference: input.externalReference,
          source: input.source,
        },
      },
    });
    if (duplicate !== null) {
      const allocation = duplicate.allocations[0];
      if (
        duplicate.amountMinor !== input.amountMinor ||
        duplicate.currency !== input.currency ||
        (duplicate.status !== 'EXCEPTION' && allocation?.orderId !== input.orderId)
      ) {
        throw new CommerceDomainError('SETTLEMENT_MISMATCH');
      }
      return { id: duplicate.id, status: duplicate.status };
    }
    return this.client.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          include: { payment: true },
          where: { id: input.orderId },
        });
        if (order?.payment === null || order === null)
          throw new CommerceDomainError('ORDER_NOT_FOUND');
        const expectedSource = order.paymentMethod === 'PAYFAST_HOSTED' ? 'PAYFAST' : 'COURIER_COD';
        if (
          input.source !== expectedSource ||
          input.currency !== order.currency ||
          input.amountMinor !== order.totalMinor
        ) {
          const exception = await transaction.settlement.create({
            data: {
              amountMinor: input.amountMinor,
              currency: input.currency,
              evidenceReference: input.evidenceReference ?? `Candidate order ${input.orderId}`,
              externalReference: input.externalReference,
              recordedById: adminId,
              receivedAt: new Date(input.receivedAt),
              source: input.source,
              status: 'EXCEPTION',
            },
          });
          return { id: exception.id, status: exception.status };
        }
        const settlement = await transaction.settlement.create({
          data: {
            amountMinor: input.amountMinor,
            currency: input.currency,
            evidenceReference: input.evidenceReference ?? null,
            externalReference: input.externalReference,
            recordedById: adminId,
            matchedAt: new Date(),
            receivedAt: new Date(input.receivedAt),
            source: input.source,
            status: 'MATCHED',
          },
        });
        await transaction.settlementAllocation.create({
          data: {
            amountMinor: input.amountMinor,
            orderId: order.id,
            paymentId: order.payment.id,
            settlementId: settlement.id,
          },
        });
        await transaction.financialEntry.create({
          data: {
            amountMinor: input.amountMinor,
            actorId: adminId,
            currency: input.currency,
            externalReference: `${input.source}:${input.externalReference}`,
            occurredAt: new Date(input.receivedAt),
            orderId: order.id,
            ruleVersion: order.financialPolicyVersion,
            type: input.source === 'PAYFAST' ? 'PAYFAST_SETTLEMENT' : 'COURIER_COD_DEPOSIT',
          },
        });
        if ((input.providerCostMinor ?? 0) > 0) {
          await transaction.financialEntry.create({
            data: {
              amountMinor: input.providerCostMinor ?? 0,
              actorId: adminId,
              currency: input.currency,
              externalReference: `provider-cost:${input.source}:${input.externalReference}`,
              occurredAt: new Date(input.receivedAt),
              orderId: order.id,
              ruleVersion: order.financialPolicyVersion,
              type: 'PROVIDER_COST',
            },
          });
        }
        await transaction.payment.update({
          data: { collectedAt: new Date(input.receivedAt), status: 'COLLECTED' },
          where: { id: order.payment.id },
        });
        return { id: settlement.id, status: settlement.status };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async requestRefund(
    requesterId: string,
    orderId: string,
    input: RefundRequestInput,
  ): Promise<RefundStatusResult> {
    return this.client.$transaction(async (transaction) => {
      const order = await transaction.order.findFirst({
        include: { payment: true, shipment: true },
        where: { id: orderId, OR: [{ buyerId: requesterId }, { sellerId: requesterId }] },
      });
      if (order?.payment === null || order === null)
        throw new CommerceDomainError('ORDER_NOT_FOUND');
      const existing = await transaction.refund.findUnique({ where: { orderId } });
      if (existing !== null) {
        return { amountMinor: existing.amountMinor, id: existing.id, status: existing.status };
      }
      if (order.payment.status !== 'COLLECTED') {
        throw new CommerceDomainError('REFUND_NOT_ALLOWED');
      }
      const beforeShipment =
        order.shipment === null &&
        ['AWAITING_PAYMENT', 'PENDING', 'CONFIRMED', 'CANCELLED'].includes(order.status);
      const withinDisputeWindow =
        order.deliveredAt !== null &&
        Date.now() <=
          (
            order.disputeWindowEndsAt ??
            new Date(order.deliveredAt.getTime() + 48 * 60 * 60 * 1_000)
          ).getTime();
      const confirmedNonDelivery =
        input.reason === 'NON_DELIVERY' &&
        order.shipment !== null &&
        ['FAILED', 'RETURNED', 'LOST'].includes(order.shipment.status);
      const validCancellation = beforeShipment && input.reason === 'VALID_CANCELLATION';
      const validDeliveredProblem = withinDisputeWindow && input.reason !== 'VALID_CANCELLATION';
      if (!validCancellation && !validDeliveredProblem && !confirmedNonDelivery) {
        throw new CommerceDomainError('REFUND_NOT_ALLOWED');
      }
      const refund = await transaction.refund.create({
        data: {
          amountMinor: order.totalMinor,
          commissionReversalMinor: order.commissionMinor,
          orderId,
          paymentId: order.payment.id,
          reason: `${input.reason}: ${input.detail}`,
          requestedById: requesterId,
        },
      });
      await transaction.payment.update({
        data: { status: 'REFUND_PENDING' },
        where: { id: order.payment.id },
      });
      return { amountMinor: refund.amountMinor, id: refund.id, status: refund.status };
    });
  }

  public async decideRefund(
    adminId: string,
    refundId: string,
    input: RefundDecisionInput,
  ): Promise<FinanceStatusResult> {
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    return this.client.$transaction(async (transaction) => {
      const refund = await transaction.refund.findUnique({
        include: { order: true },
        where: { id: refundId },
      });
      if (refund === null || refund.status !== 'REQUESTED')
        throw new CommerceDomainError('REFUND_NOT_ALLOWED');
      const now = new Date();
      const decided = await transaction.refund.update({
        data: {
          providerReference: input.providerReference ?? null,
          reviewedAt: now,
          reviewedById: adminId,
          status: input.approve ? 'APPROVED' : 'REJECTED',
        },
        where: { id: refundId },
      });
      if (!input.approve) {
        await transaction.payment.update({
          data: { status: 'COLLECTED' },
          where: { orderId: refund.orderId },
        });
      }
      return { id: decided.id, status: decided.status };
    });
  }

  public async recordRefundSucceeded(
    adminId: string,
    refundId: string,
    providerReference: string,
  ): Promise<FinanceStatusResult> {
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    return this.client.$transaction(async (transaction) => {
      const refund = await transaction.refund.findUnique({
        include: { order: true },
        where: { id: refundId },
      });
      if (refund === null || !['APPROVED', 'SUBMITTED'].includes(refund.status))
        throw new CommerceDomainError('REFUND_NOT_ALLOWED');
      const now = new Date();
      await transaction.financialEntry.create({
        data: {
          amountMinor: -refund.amountMinor,
          actorId: adminId,
          currency: refund.order.currency,
          externalReference: `refund:${providerReference}`,
          occurredAt: now,
          orderId: refund.orderId,
          ruleVersion: refund.order.financialPolicyVersion,
          type: 'REFUND',
        },
      });
      if (refund.commissionReversalMinor > 0) {
        await transaction.financialEntry.create({
          data: {
            amountMinor: -refund.commissionReversalMinor,
            actorId: adminId,
            currency: refund.order.currency,
            externalReference: `commission-reversal:${refund.id}`,
            occurredAt: now,
            orderId: refund.orderId,
            ruleVersion: refund.order.financialPolicyVersion,
            type: 'COMMISSION',
          },
        });
      }
      if (refund.order.completedAt !== null) {
        await transaction.financialEntry.create({
          data: {
            amountMinor: -refund.order.sellerNetMinor,
            actorId: adminId,
            currency: refund.order.currency,
            externalReference: `seller-payable-reversal:${refund.id}`,
            occurredAt: now,
            orderId: refund.orderId,
            ruleVersion: refund.order.financialPolicyVersion,
            type: 'SELLER_PAYABLE',
          },
        });
        if (refund.order.withholdingMinor > 0) {
          await transaction.financialEntry.create({
            data: {
              amountMinor: -refund.order.withholdingMinor,
              actorId: adminId,
              currency: refund.order.currency,
              externalReference: `withholding-reversal:${refund.id}`,
              occurredAt: now,
              orderId: refund.orderId,
              ruleVersion: refund.order.withholdingRuleVersion,
              type: 'WITHHOLDING',
            },
          });
        }
      }
      await transaction.payment.update({
        data: { refundedAt: now, status: 'REFUNDED' },
        where: { orderId: refund.orderId },
      });
      const updated = await transaction.refund.update({
        data: {
          completedAt: now,
          providerReference,
          status: refund.order.status === 'CANCELLED' ? 'SUCCEEDED' : 'STOCK_PENDING_INSPECTION',
        },
        where: { id: refundId },
      });
      return { id: updated.id, status: updated.status };
    });
  }

  public async restoreRefundedStock(adminId: string, refundId: string, evidenceReference: string) {
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    return this.client.$transaction(async (transaction) => {
      const refund = await transaction.refund.findUnique({
        include: { order: true },
        where: { id: refundId },
      });
      if (refund === null || refund.status !== 'STOCK_PENDING_INSPECTION')
        throw new CommerceDomainError('REFUND_NOT_ALLOWED');
      const listing = await transaction.listing.findUnique({
        where: { id: refund.order.listingId },
      });
      if (listing === null || (listing.stockSold < 1 && listing.stockReserved < 1))
        throw new CommerceDomainError('LISTING_NOT_AVAILABLE');
      const availableAfter = listing.stockAvailable + 1;
      const restoreSold = listing.stockSold > 0;
      const reservedAfter = listing.stockReserved - (restoreSold ? 0 : 1);
      const soldAfter = listing.stockSold - (restoreSold ? 1 : 0);
      await transaction.listing.update({
        data: {
          stockAvailable: availableAfter,
          stockReserved: reservedAfter,
          stockSold: soldAfter,
          status: 'ACTIVE',
        },
        where: { id: listing.id },
      });
      await transaction.inventoryMovement.create({
        data: {
          actorId: adminId,
          availableAfter,
          listingId: listing.id,
          orderId: refund.orderId,
          quantity: 1,
          reason: `Return inspected: ${evidenceReference}`,
          reservedAfter,
          soldAfter,
          type: 'RESTOCKED',
        },
      });
      await transaction.refund.update({
        data: { status: 'STOCK_RESTORED', stockRestoredAt: new Date() },
        where: { id: refundId },
      });
      return { id: refundId, status: 'STOCK_RESTORED' as const };
    });
  }

  public async createPayoutBatch(
    adminId: string,
    input: PayoutBatchCreateInput,
  ): Promise<PayoutBatchResult> {
    this.assertPayoutsEnabled();
    await this.requirePermission(adminId, 'PAYOUT_CREATE');
    return this.client.$transaction(
      async (transaction) => {
        const now = new Date();
        const orders = await transaction.order.findMany({
          include: {
            disputes: { where: { status: { in: [...OPEN_DISPUTE_STATES] } } },
            payoutItems: true,
            refunds: true,
            seller: {
              include: {
                payoutProfiles: {
                  orderBy: { createdAt: 'desc' },
                  where: { heldUntil: { lte: now }, status: 'ACTIVE' },
                },
              },
            },
            settlementAllocations: true,
          },
          where: { id: { in: input.orderIds } },
        });
        if (orders.length !== new Set(input.orderIds).size)
          throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
        const currency = orders[0]?.currency;
        if (currency === undefined || orders.some((order) => order.currency !== currency))
          throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
        for (const order of orders) {
          const settled = order.settlementAllocations.reduce(
            (sum, allocation) => sum + allocation.amountMinor,
            0,
          );
          if (
            order.status !== 'COMPLETED' ||
            order.payoutEligibleAt === null ||
            order.payoutEligibleAt > now ||
            order.disputes.length > 0 ||
            order.payoutItems.length > 0 ||
            order.refunds.some((refund) => refund.status !== 'REJECTED') ||
            order.seller.payoutProfiles[0] === undefined ||
            settled !== order.totalMinor
          ) {
            throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
          }
        }
        const totalMinor = orders.reduce((sum, order) => sum + order.sellerNetMinor, 0);
        const batch = await transaction.payoutBatch.create({
          data: {
            creatorId: adminId,
            currency,
            items: {
              create: orders.map((order) => ({
                amountMinor: order.sellerNetMinor,
                orderId: order.id,
                payoutProfileId: order.seller.payoutProfiles[0]!.id,
                sellerId: order.sellerId,
              })),
            },
            status: 'PENDING_APPROVAL',
            totalMinor,
          },
        });
        return { id: batch.id, status: batch.status, totalMinor: batch.totalMinor };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async approvePayoutBatch(adminId: string, batchId: string): Promise<PayoutBatchResult> {
    this.assertPayoutsEnabled();
    await this.requirePermission(adminId, 'PAYOUT_APPROVE');
    const batch = await this.client.payoutBatch.findUnique({ where: { id: batchId } });
    if (batch === null || batch.status !== 'PENDING_APPROVAL')
      throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
    if (batch.creatorId === adminId)
      throw new CommerceDomainError('PAYOUT_SEPARATION_OF_DUTIES_REQUIRED');
    const updated = await this.client.payoutBatch.update({
      data: { approvedAt: new Date(), approverId: adminId, status: 'APPROVED' },
      where: { id: batchId },
    });
    return { id: updated.id, status: updated.status, totalMinor: updated.totalMinor };
  }

  public async recordPayoutBatchPaid(
    adminId: string,
    batchId: string,
    input: PayoutBatchPaidInput,
  ): Promise<PayoutBatchResult> {
    this.assertPayoutsEnabled();
    await this.requirePermission(adminId, 'PAYOUT_APPROVE');
    return this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM payout_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
      );
      const batch = await transaction.payoutBatch.findUnique({
        include: { items: { include: { order: true } } },
        where: { id: batchId },
      });
      if (
        batch === null ||
        batch.status !== 'APPROVED' ||
        batch.approverId !== adminId ||
        input.items.length !== batch.items.length
      ) {
        throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
      }
      const references = new Map(
        input.items.map((item) => [item.payoutItemId, item.providerReference]),
      );
      if (references.size !== batch.items.length) {
        throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
      }
      const paidAt = new Date();
      for (const item of batch.items) {
        const providerReference = references.get(item.id);
        if (providerReference === undefined || item.status !== 'PENDING') {
          throw new CommerceDomainError('PAYOUT_NOT_ELIGIBLE');
        }
        await transaction.payoutItem.update({
          data: { providerReference, status: 'PAID' },
          where: { id: item.id },
        });
        await transaction.financialEntry.create({
          data: {
            amountMinor: -item.amountMinor,
            actorId: adminId,
            currency: item.order.currency,
            externalReference: `payout:${providerReference}`,
            occurredAt: paidAt,
            orderId: item.orderId,
            ruleVersion: item.order.financialPolicyVersion,
            type: 'PAYOUT',
          },
        });
      }
      const paid = await transaction.payoutBatch.update({
        data: { paidAt, status: 'PAID' },
        where: { id: batchId },
      });
      return { id: paid.id, status: paid.status, totalMinor: paid.totalMinor };
    });
  }

  public hashCallbackPayload(rawBody: Buffer): string {
    return createHash('sha256').update(rawBody).digest('hex');
  }

  public async metrics(adminId: string, input: CommerceMetricsQuery): Promise<CommerceMetrics> {
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    const from = input.from === undefined ? new Date(0) : new Date(input.from);
    const to = input.to === undefined ? new Date() : new Date(input.to);
    const createdRange = { gte: from, lte: to };
    const [
      registrations,
      activeActorRows,
      sellerRows,
      activeSellerRows,
      orders,
      placedGmv,
      completedGmv,
      unitsSold,
      commissionAccrued,
      financeEntries,
      refunds,
      payoutBatches,
      payoutItems,
      reconciliationExceptions,
      disputes,
    ] = await Promise.all([
      this.client.user.count({ where: { createdAt: createdRange } }),
      this.client.marketplaceAnalyticsEvent.findMany({
        distinct: ['actorId'],
        select: { actorId: true },
        where: { actorId: { not: null }, occurredAt: createdRange },
      }),
      this.client.listing.findMany({
        distinct: ['sellerId'],
        select: { sellerId: true },
        where: { createdAt: createdRange },
      }),
      this.client.listing.findMany({
        distinct: ['sellerId'],
        select: { sellerId: true },
        where: { status: { in: ['ACTIVE', 'RESERVED'] }, updatedAt: createdRange },
      }),
      this.client.order.count({ where: { createdAt: createdRange } }),
      this.client.order.aggregate({
        _sum: { itemSubtotalMinor: true },
        where: { createdAt: createdRange },
      }),
      this.client.order.aggregate({
        _sum: { itemSubtotalMinor: true },
        where: { completedAt: createdRange },
      }),
      this.client.order.aggregate({
        _sum: { quantity: true },
        where: { completedAt: createdRange },
      }),
      this.client.order.aggregate({
        _sum: { commissionMinor: true },
        where: { createdAt: createdRange, status: { not: 'CANCELLED' } },
      }),
      this.client.financialEntry.groupBy({
        by: ['type'],
        _sum: { amountMinor: true },
        where: { occurredAt: createdRange },
      }),
      this.client.refund.aggregate({
        _sum: { amountMinor: true },
        where: {
          completedAt: createdRange,
          status: { in: ['SUCCEEDED', 'STOCK_PENDING_INSPECTION', 'STOCK_RESTORED'] },
        },
      }),
      this.client.payoutBatch.count({ where: { createdAt: createdRange } }),
      this.client.payoutItem.aggregate({
        _sum: { amountMinor: true },
        where: { createdAt: createdRange, status: 'PAID' },
      }),
      this.client.settlement.count({ where: { createdAt: createdRange, status: 'EXCEPTION' } }),
      this.client.dispute.count({ where: { createdAt: createdRange } }),
    ]);
    const sums = new Map(financeEntries.map((entry) => [entry.type, entry._sum.amountMinor ?? 0]));
    const commissionNet = sums.get('COMMISSION') ?? 0;
    const commissionEarnedMinor = Math.max(0, commissionNet);
    const commissionReversedMinor = Math.abs(Math.min(0, commissionNet));
    const providerCostsMinor = Math.abs(sums.get('PROVIDER_COST') ?? 0);
    const courierCostsMinor = Math.abs(sums.get('COURIER_COST') ?? 0);
    const sellerPayable = sums.get('SELLER_PAYABLE') ?? 0;
    const payoutsMinor = payoutItems._sum.amountMinor ?? 0;
    return {
      activeSellers: activeSellerRows.length,
      activeUsers: activeActorRows.length,
      commissionAccruedMinor: commissionAccrued._sum.commissionMinor ?? 0,
      commissionEarnedMinor,
      commissionReversedMinor,
      completedGmvMinor: completedGmv._sum.itemSubtotalMinor ?? 0,
      contributionMarginMinor: commissionNet - providerCostsMinor - courierCostsMinor,
      courierCostsMinor,
      disputes,
      from: from.toISOString(),
      orders,
      payoutBatches,
      payoutsMinor,
      placedGmvMinor: placedGmv._sum.itemSubtotalMinor ?? 0,
      providerCostsMinor,
      reconciliationExceptions,
      refundsMinor: refunds._sum.amountMinor ?? 0,
      registrations,
      sellerLiabilitiesMinor: sellerPayable - payoutsMinor,
      to: to.toISOString(),
      totalSellers: sellerRows.length,
      unitsSold: unitsSold._sum.quantity ?? 0,
    };
  }

  public async sellerInventory(adminId: string) {
    await this.requirePermission(adminId, 'FINANCE_RECONCILIATION');
    const sellers = await this.client.user.findMany({
      include: { listings: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }, profile: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: { listings: { some: {} } },
    });
    return sellers.map((seller) => ({
      active: seller.listings.some((listing) => ['ACTIVE', 'RESERVED'].includes(listing.status)),
      listingCount: seller.listings.length,
      listings: seller.listings.map((listing) => ({
        id: listing.id,
        stockAvailable: listing.stockAvailable,
        stockReserved: listing.stockReserved,
        stockSold: listing.stockSold,
        status: listing.status,
        title: listing.title,
      })),
      sellerId: seller.id,
      username: seller.profile?.username ?? 'unavailable',
    }));
  }

  public async metricsCsv(adminId: string, input: CommerceMetricsQuery): Promise<string> {
    const metrics = await this.metrics(adminId, input);
    const rows = Object.entries(metrics);
    return ['metric,value', ...rows.map(([key, value]) => `${key},${String(value)}`)].join('\n');
  }

  public async updateShipment(adminId: string, orderId: string, input: AdminShipmentInput) {
    await this.requirePermission(adminId, 'OPERATIONS');
    return this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`,
      );
      const order = await transaction.order.findUnique({
        include: { shipment: true },
        where: { id: orderId },
      });
      const repeatedStatus = order?.shipment?.status === input.status;
      if (
        order === null ||
        ['AWAITING_PAYMENT', 'CANCELLED'].includes(order.status) ||
        (order.status === 'COMPLETED' &&
          !repeatedStatus &&
          !['RETURNING', 'RETURNED'].includes(input.status))
      ) {
        throw new CommerceDomainError('SHIPMENT_INVALID_STATE');
      }
      if (!canTransitionShipment(order.shipment?.status ?? null, input.status)) {
        throw new CommerceDomainError('SHIPMENT_INVALID_STATE');
      }
      if (input.status === 'DELIVERED' && order.status !== 'SHIPPED' && !repeatedStatus) {
        throw new CommerceDomainError('SHIPMENT_INVALID_STATE');
      }
      const now = new Date();
      const timestamps = {
        ...(input.status === 'BOOKED' ? { bookedAt: now } : {}),
        ...(input.status === 'PICKED_UP' ? { pickedUpAt: now } : {}),
        ...(input.status === 'IN_TRANSIT' ? { shippedAt: now } : {}),
        ...(input.status === 'DELIVERED' ? { deliveredAt: now } : {}),
        ...(input.status === 'RETURNED' ? { returnedAt: now } : {}),
      };
      const shipment = await transaction.shipment.upsert({
        create: {
          courierReference: input.courierReference,
          evidenceReference: input.evidenceReference,
          feeMinor: input.feeMinor,
          orderId,
          providerCode: 'LOCAL_COURIER_MANUAL',
          providerDisplayName: 'Thriftage-arranged Lahore courier',
          status: input.status,
          trackingNumber: input.courierReference,
          ...timestamps,
        },
        update: {
          courierReference: input.courierReference,
          evidenceReference: input.evidenceReference,
          feeMinor: input.feeMinor,
          status: input.status,
          trackingNumber: input.courierReference,
          ...timestamps,
        },
        where: { orderId },
      });
      const courierCostDelta = input.feeMinor - (order.shipment?.feeMinor ?? 0);
      if (courierCostDelta !== 0) {
        await transaction.financialEntry.create({
          data: {
            amountMinor: courierCostDelta,
            actorId: adminId,
            currency: order.currency,
            externalReference: `courier-cost:${orderId}:${input.courierReference}:${now.toISOString()}`,
            occurredAt: now,
            orderId,
            ruleVersion: order.financialPolicyVersion,
            type: 'COURIER_COST',
          },
        });
      }
      if (input.status === 'IN_TRANSIT' && ['PENDING', 'CONFIRMED'].includes(order.status)) {
        await transaction.order.update({
          data: { shippedAt: now, status: 'SHIPPED' },
          where: { id: orderId },
        });
        await transaction.orderEvent.create({
          data: {
            actorId: adminId,
            actorType: 'ADMIN',
            nextState: 'SHIPPED',
            orderId,
            previousState: order.status,
            type: 'MARKED_SHIPPED',
          },
        });
      }
      if (input.status === 'DELIVERED' && order.status === 'SHIPPED') {
        const disputeWindowEndsAt = new Date(now.getTime() + 48 * 60 * 60 * 1_000);
        await transaction.order.update({
          data: { deliveredAt: now, disputeWindowEndsAt, status: 'DELIVERED' },
          where: { id: orderId },
        });
        await transaction.orderEvent.create({
          data: {
            actorId: adminId,
            actorType: 'ADMIN',
            nextState: 'DELIVERED',
            orderId,
            previousState: order.status,
            type: 'MARKED_DELIVERED',
          },
        });
      }
      return { id: shipment.id, status: shipment.status };
    });
  }
}
