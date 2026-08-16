import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { NotificationRepository } from './notification.repository';
import { PUSH_PROVIDER, PushProviderError, type PushProvider } from './push-provider.interface';

function operationalPushErrorCode(error: unknown): string {
  return error instanceof PushProviderError ? error.code : 'OUTBOX_PROCESSING_FAILED';
}

function receiptErrorCode(errorCode: string | undefined): string | null {
  if (errorCode === undefined) return null;
  return errorCode === 'DeviceNotRegistered' ? 'PUSH_DEVICE_UNREGISTERED' : 'PUSH_RECEIPT_REJECTED';
}

@Injectable()
export class NotificationOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private receiptTimer?: ReturnType<typeof setInterval>;
  private running = false;
  public constructor(
    @Inject(NotificationRepository) private readonly repository: NotificationRepository,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}
  public onModuleInit(): void {
    const interval = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1_000);
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
    this.receiptTimer = setInterval(() => void this.checkReceipts(), 60_000);
    this.receiptTimer.unref();
  }
  public onModuleDestroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    if (this.receiptTimer !== undefined) clearInterval(this.receiptTimer);
  }
  public async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.repository.claimOutbox(Number(process.env.OUTBOX_BATCH_SIZE ?? 25));
      for (const row of rows) await this.process(row);
    } catch {
      this.logger.error('Notification outbox polling failed: code=OUTBOX_POLL_FAILED');
    } finally {
      this.running = false;
    }
  }
  private async process(
    row: Awaited<ReturnType<NotificationRepository['claimOutbox']>>[number],
  ): Promise<void> {
    try {
      const notification = await this.repository.materialize(row);
      const devices = await this.repository.db.pushDevice.findMany({
        where: { active: true, userId: row.recipientId },
      });
      for (const device of devices) {
        const delivery = await this.repository.db.pushDelivery.upsert({
          create: { notificationId: notification.id, pushDeviceId: device.id },
          update: {},
          where: {
            notificationId_pushDeviceId: {
              notificationId: notification.id,
              pushDeviceId: device.id,
            },
          },
        });
        if (['TICKET_ACCEPTED', 'DELIVERED', 'DEVICE_UNREGISTERED'].includes(delivery.status))
          continue;
        try {
          const ticket = await this.push.send({
            body: notification.body,
            data: {
              ...(notification.conversationId === null
                ? {}
                : { conversationId: notification.conversationId }),
              ...(notification.orderId === null ? {} : { orderId: notification.orderId }),
              ...(notification.reviewId === null ? {} : { reviewId: notification.reviewId }),
              ...(notification.disputeId === null ? {} : { disputeId: notification.disputeId }),
              ...(notification.sellerVerificationId === null
                ? {}
                : { sellerVerificationId: notification.sellerVerificationId }),
              type: notification.type,
            },
            title: notification.title,
            token: device.expoPushToken,
          });
          await this.repository.db.pushDelivery.update({
            data: {
              attempts: { increment: 1 },
              nextReceiptAt: new Date(
                Date.now() + Number(process.env.PUSH_RECEIPT_DELAY_SECONDS ?? 900) * 1_000,
              ),
              status: 'TICKET_ACCEPTED',
              ticketId: ticket.id,
            },
            where: { id: delivery.id },
          });
        } catch (error) {
          const code = operationalPushErrorCode(error);
          const unregistered = code === 'PUSH_DEVICE_UNREGISTERED';
          await this.repository.db.$transaction([
            this.repository.db.pushDelivery.update({
              data: {
                attempts: { increment: 1 },
                lastErrorCode: code,
                status: unregistered ? 'DEVICE_UNREGISTERED' : 'RETRY',
              },
              where: { id: delivery.id },
            }),
            ...(unregistered
              ? [
                  this.repository.db.pushDevice.update({
                    data: { active: false },
                    where: { id: device.id },
                  }),
                ]
              : []),
          ]);
          if (unregistered) continue;
          throw error;
        }
      }
      await this.repository.db.notificationOutbox.update({
        data: { lockedAt: null, processedAt: new Date(), status: 'SUCCEEDED' },
        where: { id: row.id },
      });
    } catch (error) {
      const max = Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 10);
      const exhausted = row.attempts + 1 >= max;
      await this.repository.db.notificationOutbox.update({
        data: {
          availableAt: new Date(
            Date.now() + Math.min(300_000, 2 ** Math.min(row.attempts, 8) * 1_000),
          ),
          lastErrorCode: operationalPushErrorCode(error),
          lockedAt: null,
          status: exhausted ? 'FAILED' : 'PENDING',
        },
        where: { id: row.id },
      });
    }
  }
  public async checkReceipts(): Promise<void> {
    const deliveries = await this.repository.db.pushDelivery.findMany({
      include: { pushDevice: true },
      take: 100,
      where: {
        nextReceiptAt: { lte: new Date() },
        status: 'TICKET_ACCEPTED',
        ticketId: { not: null },
      },
    });
    const ids = deliveries.flatMap((delivery) =>
      delivery.ticketId === null ? [] : [delivery.ticketId],
    );
    if (ids.length === 0) return;
    try {
      const receipts = await this.push.receipts(ids);
      for (const delivery of deliveries) {
        if (delivery.ticketId === null) continue;
        const receipt = receipts.get(delivery.ticketId);
        if (receipt === undefined) continue;
        const unregistered = receipt.errorCode === 'DeviceNotRegistered';
        await this.repository.db.$transaction([
          this.repository.db.pushDelivery.update({
            data: {
              lastErrorCode: receiptErrorCode(receipt.errorCode),
              nextReceiptAt: null,
              status:
                receipt.status === 'ok'
                  ? 'DELIVERED'
                  : unregistered
                    ? 'DEVICE_UNREGISTERED'
                    : 'FAILED',
            },
            where: { id: delivery.id },
          }),
          ...(unregistered
            ? [
                this.repository.db.pushDevice.update({
                  data: { active: false },
                  where: { id: delivery.pushDeviceId },
                }),
              ]
            : []),
        ]);
      }
    } catch {
      this.logger.warn(
        'Expo receipt check failed; accepted tickets remain retryable: code=PUSH_RECEIPT_CHECK_FAILED',
      );
    }
  }
}
