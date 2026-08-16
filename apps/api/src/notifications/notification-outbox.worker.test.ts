import type { NotificationOutbox } from '@thriftage/db';
import { describe, expect, it, vi } from 'vitest';

import { NotificationOutboxWorker } from './notification-outbox.worker';
import type { NotificationRepository } from './notification.repository';
import { PushProviderError, type PushProvider } from './push-provider.interface';

const outbox: NotificationOutbox = {
  actorUserId: null,
  attempts: 0,
  availableAt: new Date('2026-08-16T00:00:00.000Z'),
  conversationId: null,
  createdAt: new Date('2026-08-16T00:00:00.000Z'),
  dedupeKey: 'test:notification',
  disputeId: null,
  eventType: 'NEW_MESSAGE',
  id: '3a6e08ad-c9c8-498c-a743-da69863a92dc',
  lastErrorCode: null,
  listingId: null,
  lockedAt: null,
  messageId: null,
  orderId: null,
  processedAt: null,
  recipientId: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  reviewId: null,
  sellerVerificationId: null,
  status: 'PROCESSING',
  updatedAt: new Date('2026-08-16T00:00:00.000Z'),
};

function harness(error: PushProviderError) {
  const pushDeliveryUpdate = vi.fn().mockResolvedValue({});
  const pushDeviceUpdate = vi.fn().mockResolvedValue({});
  const outboxUpdate = vi.fn().mockResolvedValue({});
  const repository = {
    claimOutbox: vi.fn().mockResolvedValue([outbox]),
    db: {
      $transaction: vi.fn(async (operations: readonly Promise<unknown>[]) =>
        Promise.all(operations),
      ),
      notificationOutbox: { update: outboxUpdate },
      pushDelivery: {
        upsert: vi.fn().mockResolvedValue({ id: 'delivery-id', status: 'PENDING' }),
        update: pushDeliveryUpdate,
      },
      pushDevice: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ expoPushToken: 'ExponentPushToken[test]', id: 'device-id' }]),
        update: pushDeviceUpdate,
      },
    },
    materialize: vi.fn().mockResolvedValue({
      body: 'Safe body',
      conversationId: null,
      disputeId: null,
      id: 'notification-id',
      orderId: null,
      reviewId: null,
      sellerVerificationId: null,
      title: 'Safe title',
      type: 'NEW_MESSAGE',
    }),
  };
  const push: PushProvider = {
    receipts: vi.fn().mockResolvedValue(new Map()),
    send: vi.fn().mockRejectedValue(error),
  };
  return {
    outboxUpdate,
    pushDeliveryUpdate,
    pushDeviceUpdate,
    repository,
    worker: new NotificationOutboxWorker(repository as unknown as NotificationRepository, push),
  };
}

describe('NotificationOutboxWorker resilience', () => {
  it('persists only a stable code and leaves provider outages retryable', async () => {
    const state = harness(new PushProviderError('PUSH_PROVIDER_UNAVAILABLE'));

    await state.worker.tick();

    expect(state.pushDeliveryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastErrorCode: 'PUSH_PROVIDER_UNAVAILABLE',
          status: 'RETRY',
        }),
      }),
    );
    expect(state.outboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastErrorCode: 'PUSH_PROVIDER_UNAVAILABLE',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('deactivates an unregistered device without retrying the committed business event', async () => {
    const state = harness(new PushProviderError('PUSH_DEVICE_UNREGISTERED'));

    await state.worker.tick();

    expect(state.pushDeviceUpdate).toHaveBeenCalledWith({
      data: { active: false },
      where: { id: 'device-id' },
    });
    expect(state.outboxUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processedAt: expect.any(Date), status: 'SUCCEEDED' }),
      }),
    );
  });
});
