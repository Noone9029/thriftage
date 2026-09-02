import type { PrismaClient } from '@thriftage/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PayFastGateway, PayFastGatewayEvent } from './payfast-gateway.interface';
import { PayFastPaymentService } from './payfast-payment.service';

const event: PayFastGatewayEvent = {
  amountMinor: 175_000,
  currency: 'PKR',
  eventId: 'payfast-event-1',
  orderId: '8b848cb0-72d6-4574-b721-c4a9d5bc61db',
  providerReference: 'payfast-provider-1',
  status: 'PAID',
};

function gateway(overrides: Partial<PayFastGateway> = {}): PayFastGateway {
  return {
    createHostedSession: vi.fn(),
    getAuthoritativeStatus: vi.fn(async () => event),
    verifyCallback: vi.fn(async () => event),
    ...overrides,
  };
}

function paidTransaction(duplicate: boolean, providerReference = event.providerReference) {
  return {
    $queryRaw: vi.fn(async () => []),
    order: {
      findUnique: vi.fn(async () => ({
        currency: 'PKR',
        id: event.orderId,
        payment: {
          id: '01f30bb2-6006-46b3-ab21-85cbb0aa57bb',
          provider: 'PAYFAST',
          providerReference,
        },
        status: 'AWAITING_PAYMENT',
        totalMinor: event.amountMinor,
      })),
      update: vi.fn(async () => ({})),
    },
    orderEvent: { create: vi.fn(async () => ({})) },
    payment: { update: vi.fn(async () => ({})) },
    paymentProviderEvent: {
      create: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => (duplicate ? { id: 'duplicate' } : null)),
    },
  };
}

describe('PayFastPaymentService callback controls', () => {
  beforeEach(() => {
    vi.stubEnv('PAYFAST_ENABLED', 'true');
    vi.stubEnv('PHONE_AUTH_ENABLED', 'false');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-placeholder');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-placeholder');
    vi.stubEnv('SUPABASE_URL', 'https://project-ref.supabase.co');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('persists an idempotent hosted session before returning its redirect', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const createHostedSession = vi.fn(async () => ({
      expiresAt,
      providerReference: event.providerReference,
      redirectUrl: 'https://sandbox.example.test/checkout/session-1',
    }));
    const paymentUpdate = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      order: {
        findFirst: vi.fn(async () => ({
          buyer: { email: 'buyer@example.test', phone: '+923001234567' },
          currency: event.currency,
          id: event.orderId,
          payment: {
            checkoutUrl: null,
            expiresAt: new Date(Date.now() + 15 * 60_000),
            id: '01f30bb2-6006-46b3-ab21-85cbb0aa57bb',
            provider: 'PAYFAST',
            providerReference: `payfast:pending:${event.orderId}`,
          },
          paymentExpiresAt: new Date(Date.now() + 15 * 60_000),
          status: 'AWAITING_PAYMENT',
          totalMinor: event.amountMinor,
        })),
      },
      payment: { updateMany: paymentUpdate },
    } as unknown as PrismaClient;
    const service = new PayFastPaymentService(gateway({ createHostedSession }), prisma);

    await expect(service.checkout('buyer-1', event.orderId)).resolves.toEqual({
      expiresAt,
      redirectUrl: 'https://sandbox.example.test/checkout/session-1',
    });

    expect(createHostedSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: event.orderId, orderId: event.orderId }),
    );
    expect(paymentUpdate).toHaveBeenCalledWith({
      data: {
        checkoutUrl: 'https://sandbox.example.test/checkout/session-1',
        expiresAt,
        providerReference: event.providerReference,
      },
      where: {
        id: '01f30bb2-6006-46b3-ab21-85cbb0aa57bb',
        order: { status: 'AWAITING_PAYMENT' },
        status: 'REQUIRES_ACTION',
      },
    });
  });

  it('verifies the exact body, queries authoritative status, and records one successful event', async () => {
    const provider = gateway();
    const transaction = paidTransaction(false);
    const prisma = {
      $transaction: (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new PayFastPaymentService(provider, prisma);
    const body = Buffer.from('merchant_reference=exact-signed-payload');

    await expect(service.callback(body, 'valid-signature')).resolves.toBeUndefined();

    expect(provider.verifyCallback).toHaveBeenCalledWith(body, 'valid-signature');
    expect(provider.getAuthoritativeStatus).toHaveBeenCalledWith(event.providerReference);
    expect(transaction.paymentProviderEvent.create).toHaveBeenCalledOnce();
    expect(transaction.payment.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerReference: event.providerReference,
        status: 'COLLECTED',
      }),
      where: { id: '01f30bb2-6006-46b3-ab21-85cbb0aa57bb' },
    });
    expect(transaction.order.update).toHaveBeenCalledWith({
      data: { status: 'PENDING' },
      where: { id: event.orderId },
    });
  });

  it('rejects invalid signatures before querying or mutating authoritative state', async () => {
    const status = vi.fn();
    const provider = gateway({
      getAuthoritativeStatus: status,
      verifyCallback: vi.fn(async () => Promise.reject(new Error('bad signature'))),
    });
    const service = new PayFastPaymentService(provider, {} as PrismaClient);

    await expect(service.callback(Buffer.from('untrusted'), 'invalid')).rejects.toMatchObject({
      code: 'PAYMENT_SIGNATURE_INVALID',
    });
    expect(status).not.toHaveBeenCalled();
  });

  it('rejects disagreement with authoritative provider status', async () => {
    const provider = gateway({
      getAuthoritativeStatus: vi.fn(async () => ({ ...event, amountMinor: event.amountMinor + 1 })),
    });
    const service = new PayFastPaymentService(provider, {} as PrismaClient);

    await expect(service.callback(Buffer.from('signed'), 'valid')).rejects.toMatchObject({
      code: 'PAYMENT_STATUS_MISMATCH',
    });
  });

  it('rejects a callback whose provider reference does not match the hosted session', async () => {
    const transaction = paidTransaction(false, 'different-provider-reference');
    const prisma = {
      $transaction: (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new PayFastPaymentService(gateway(), prisma);

    await expect(service.callback(Buffer.from('signed'), 'valid')).rejects.toMatchObject({
      code: 'PAYMENT_STATUS_MISMATCH',
    });
    expect(transaction.paymentProviderEvent.create).not.toHaveBeenCalled();
  });

  it('deduplicates a provider event before repeating payment or order transitions', async () => {
    const provider = gateway();
    const transaction = paidTransaction(true);
    const prisma = {
      $transaction: (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction),
    } as unknown as PrismaClient;
    const service = new PayFastPaymentService(provider, prisma);

    await service.callback(Buffer.from('signed'), 'valid');

    expect(transaction.paymentProviderEvent.create).not.toHaveBeenCalled();
    expect(transaction.payment.update).not.toHaveBeenCalled();
    expect(transaction.order.update).not.toHaveBeenCalled();
  });

  it('retains an expired reservation while authoritative status is unavailable', async () => {
    const provider = gateway({
      getAuthoritativeStatus: vi.fn(async () => Promise.reject(new Error('provider outage'))),
    });
    const transaction = vi.fn();
    const prisma = {
      $transaction: transaction,
      order: {
        findMany: vi.fn(async () => [
          {
            id: event.orderId,
            payment: { providerReference: event.providerReference },
            paymentExpiresAt: new Date(Date.now() - 60_000),
          },
        ]),
      },
    } as unknown as PrismaClient;
    const service = new PayFastPaymentService(provider, prisma);

    await expect(service.expireDue()).resolves.toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });
});
