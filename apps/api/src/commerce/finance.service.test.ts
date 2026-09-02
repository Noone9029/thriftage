import { randomUUID } from 'node:crypto';

import type { PrismaClient, User } from '@thriftage/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { canTransitionShipment, FinanceService } from './finance.service';

const sellerId = '0b706b4e-d9cf-48e7-8668-82c9f2460dd8';
const sellerPhone = '+923001234567';

function seller(): User {
  return {
    id: sellerId,
    phone: sellerPhone,
    phoneVerified: true,
  } as User;
}

function context(): AuthenticatedRequestContext {
  return {
    accessToken: 'synthetic-test-token',
    identity: {
      assuranceLevel: 'aal1',
      authProviderUserId: 'synthetic-provider-user',
      email: 'seller@example.com',
      issuedAt: new Date(),
      phone: sellerPhone,
      sessionId: 'synthetic-session',
    },
  };
}

describe('FinanceService payout controls', () => {
  beforeEach(() => {
    vi.stubEnv('PHONE_AUTH_ENABLED', 'false');
    vi.stubEnv('PAYOUTS_ENABLED', 'true');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-placeholder');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-placeholder');
    vi.stubEnv('SUPABASE_URL', 'https://project-ref.supabase.co');
    vi.stubEnv('PAYOUT_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64url'));
  });

  afterEach(() => vi.unstubAllEnvs());

  it('encrypts wallet destinations, masks API output, applies the 72-hour hold, and notifies', async () => {
    const payoutCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      createdAt: new Date(),
      id: randomUUID(),
      status: 'PENDING_REVIEW',
      updatedAt: new Date(),
    }));
    const notificationCreate = vi.fn(async () => ({ id: randomUUID() }));
    const transaction = {
      notificationOutbox: { create: notificationCreate },
      sellerPayoutProfile: { create: payoutCreate },
    };
    const prisma = {
      $transaction: (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new FinanceService(prisma);
    const startedAt = Date.now();

    const profile = await service.createPayoutProfile(seller(), context(), {
      accountTitle: 'Synthetic Seller',
      destination: sellerPhone,
      type: 'EASYPAISA',
    });

    expect(profile).toMatchObject({
      accountTitle: 'Synthetic Seller',
      displayLabel: 'Easypaisa ending 4567',
      status: 'PENDING_REVIEW',
    });
    expect(new Date(profile.heldUntil).getTime()).toBeGreaterThanOrEqual(
      startedAt + 72 * 60 * 60 * 1_000,
    );
    const encrypted = payoutCreate.mock.calls[0]![0].data;
    expect(encrypted.destinationCiphertext).not.toContain(sellerPhone);
    expect(encrypted.destinationFingerprint).not.toBe(sellerPhone);
    expect(profile).not.toHaveProperty('destinationCiphertext');
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'PAYOUT_DESTINATION_CHANGED',
        recipientId: sellerId,
      }),
    });
  });

  it('rejects a wallet number that does not match the verified account phone', async () => {
    const service = new FinanceService({} as PrismaClient);
    await expect(
      service.createPayoutProfile(seller(), context(), {
        accountTitle: 'Synthetic Seller',
        destination: '+923009999999',
        type: 'JAZZCASH',
      }),
    ).rejects.toMatchObject({ code: 'PAYOUT_DESTINATION_INVALID' });
  });

  it('requires a different authorized administrator to approve a payout batch', async () => {
    const batchId = randomUUID();
    const creatorId = randomUUID();
    const update = vi.fn();
    const prisma = {
      adminPermissionGrant: { findUnique: vi.fn(async () => ({ id: randomUUID() })) },
      payoutBatch: {
        findUnique: vi.fn(async () => ({ creatorId, id: batchId, status: 'PENDING_APPROVAL' })),
        update,
      },
    } as unknown as PrismaClient;
    const service = new FinanceService(prisma);

    await expect(service.approvePayoutBatch(creatorId, batchId)).rejects.toMatchObject({
      code: 'PAYOUT_SEPARATION_OF_DUTIES_REQUIRED',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not create a refund for money that was never collected', async () => {
    const orderId = randomUUID();
    const transaction = {
      order: {
        findFirst: vi.fn(async () => ({
          id: orderId,
          payment: { status: 'REQUIRES_ACTION' },
          shipment: null,
          status: 'AWAITING_PAYMENT',
        })),
      },
      refund: { findUnique: vi.fn(async () => null) },
    };
    const prisma = {
      $transaction: (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new FinanceService(prisma);

    await expect(
      service.requestRefund(sellerId, orderId, {
        detail: 'Buyer cancelled before completing the hosted checkout.',
        reason: 'VALID_CANCELLATION',
      }),
    ).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' });
  });

  it('excludes an order with a pending refund from payout batching', async () => {
    const orderId = randomUUID();
    const createBatch = vi.fn();
    const transaction = {
      order: {
        findMany: vi.fn(async () => [
          {
            currency: 'PKR',
            disputes: [],
            id: orderId,
            payoutEligibleAt: new Date(Date.now() - 60_000),
            payoutItems: [],
            refunds: [{ status: 'REQUESTED' }],
            seller: { payoutProfiles: [{ id: randomUUID() }] },
            sellerNetMinor: 90_000,
            settlementAllocations: [{ amountMinor: 100_000 }],
            status: 'COMPLETED',
            totalMinor: 100_000,
          },
        ]),
      },
      payoutBatch: { create: createBatch },
    };
    const prisma = {
      adminPermissionGrant: { findUnique: vi.fn(async () => ({ id: randomUUID() })) },
      $transaction: (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new FinanceService(prisma);

    await expect(
      service.createPayoutBatch(randomUUID(), { orderIds: [orderId] }),
    ).rejects.toMatchObject({ code: 'PAYOUT_NOT_ELIGIBLE' });
    expect(createBatch).not.toHaveBeenCalled();
  });

  it('reverses seller liability when a completed order is fully refunded', async () => {
    const adminId = randomUUID();
    const orderId = randomUUID();
    const refundId = randomUUID();
    const createEntry = vi.fn(async () => ({ id: randomUUID() }));
    const transaction = {
      financialEntry: { create: createEntry },
      payment: { update: vi.fn(async () => ({})) },
      refund: {
        findUnique: vi.fn(async () => ({
          amountMinor: 110_000,
          commissionReversalMinor: 10_000,
          id: refundId,
          order: {
            completedAt: new Date(),
            currency: 'PKR',
            financialPolicyVersion: 'marketplace-fees-v1',
            sellerNetMinor: 90_000,
            shippedAt: new Date(),
            status: 'COMPLETED',
            withholdingMinor: 0,
            withholdingRuleVersion: 'withholding-unapproved-v1',
          },
          orderId,
          status: 'APPROVED',
        })),
        update: vi.fn(async () => ({ id: refundId, status: 'STOCK_PENDING_INSPECTION' })),
      },
    };
    const prisma = {
      adminPermissionGrant: { findUnique: vi.fn(async () => ({ id: randomUUID() })) },
      $transaction: (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new FinanceService(prisma);

    await service.recordRefundSucceeded(adminId, refundId, 'provider-refund-1');

    expect(createEntry).toHaveBeenCalledWith({
      data: expect.objectContaining({ amountMinor: -90_000, type: 'SELLER_PAYABLE' }),
    });
  });
});

describe('manual courier status transitions', () => {
  it('requires the structured forward path and permits idempotent retries', () => {
    expect(canTransitionShipment(null, 'BOOKED')).toBe(true);
    expect(canTransitionShipment('BOOKED', 'PICKED_UP')).toBe(true);
    expect(canTransitionShipment('PICKED_UP', 'IN_TRANSIT')).toBe(true);
    expect(canTransitionShipment('IN_TRANSIT', 'DELIVERED')).toBe(true);
    expect(canTransitionShipment('DELIVERED', 'RETURNING')).toBe(true);
    expect(canTransitionShipment('RETURNING', 'RETURNED')).toBe(true);
    expect(canTransitionShipment('IN_TRANSIT', 'IN_TRANSIT')).toBe(true);
  });

  it('rejects skipped and backward courier states', () => {
    expect(canTransitionShipment(null, 'DELIVERED')).toBe(false);
    expect(canTransitionShipment('BOOKED', 'DELIVERED')).toBe(false);
    expect(canTransitionShipment('DELIVERED', 'IN_TRANSIT')).toBe(false);
    expect(canTransitionShipment('RETURNED', 'BOOKED')).toBe(false);
  });
});
