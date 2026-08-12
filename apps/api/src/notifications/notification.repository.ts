import { Injectable } from '@nestjs/common';
import { getPrismaClient, Prisma, type NotificationType, type PrismaClient } from '@thriftage/db';
import type { PushDeviceInput } from '@thriftage/shared';

import { NotificationDomainError } from './notification.errors';

@Injectable()
export class NotificationRepository {
  public constructor(private readonly prisma?: PrismaClient) {}
  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }
  public list(userId: string, limit: number) {
    return this.client.notification.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      where: { recipientId: userId },
    });
  }
  public unreadCount(userId: string) {
    return this.client.notification.count({ where: { readAt: null, recipientId: userId } });
  }
  public async markRead(userId: string, notificationId: string) {
    const result = await this.client.notification.updateMany({
      data: { readAt: new Date() },
      where: { id: notificationId, recipientId: userId },
    });
    if (result.count === 0) throw new NotificationDomainError('NOTIFICATION_NOT_FOUND');
  }
  public markAllRead(userId: string) {
    return this.client.notification.updateMany({
      data: { readAt: new Date() },
      where: { readAt: null, recipientId: userId },
    });
  }
  public registerDevice(userId: string, input: PushDeviceInput) {
    return this.client.pushDevice.upsert({
      create: { ...input, userId },
      update: { active: true, lastSeenAt: new Date(), platform: input.platform, userId },
      where: { expoPushToken: input.expoPushToken },
    });
  }
  public deactivateDevice(userId: string, deviceId: string) {
    return this.client.pushDevice.updateMany({
      data: { active: false },
      where: { id: deviceId, userId },
    });
  }
  public deactivateToken(token: string) {
    return this.client.pushDevice.updateMany({
      data: { active: false },
      where: { expoPushToken: token },
    });
  }
  public get activeDevices() {
    return this.client.pushDevice;
  }
  public get db(): PrismaClient {
    return this.client;
  }

  public async claimOutbox(limit: number) {
    return this.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<readonly { id: string }[]>(Prisma.sql`
        SELECT id FROM notification_outbox
        WHERE status IN ('PENDING'::"NotificationOutboxStatus", 'PROCESSING'::"NotificationOutboxStatus")
          AND available_at <= now() AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT ${limit}
      `);
      const ids = rows.map(({ id }) => id);
      if (ids.length === 0) return [];
      await transaction.notificationOutbox.updateMany({
        data: { attempts: { increment: 1 }, lockedAt: new Date(), status: 'PROCESSING' },
        where: { id: { in: ids } },
      });
      return transaction.notificationOutbox.findMany({ where: { id: { in: ids } } });
    });
  }

  public async materialize(outbox: {
    readonly actorUserId: string | null;
    readonly conversationId: string | null;
    readonly dedupeKey: string;
    readonly eventType: NotificationType;
    readonly listingId: string | null;
    readonly orderId: string | null;
    readonly recipientId: string;
  }) {
    const copy: Record<NotificationType, { title: string; body: string }> = {
      ITEM_PURCHASED: { title: 'New order', body: 'A buyer placed an order for your item.' },
      ITEM_SOLD: { title: 'Item sold', body: 'Your transaction is complete.' },
      LISTING_APPROVED: { title: 'Listing approved', body: 'Your listing is now live.' },
      LISTING_REJECTED: { title: 'Listing needs changes', body: 'Review the moderation result.' },
      LISTING_REMOVED: { title: 'Listing removed', body: 'Review the moderation result.' },
      NEW_FOLLOWER: { title: 'New follower', body: 'Someone followed your profile.' },
      NEW_MESSAGE: { title: 'New message', body: 'You received a message in Thriftage.' },
      ORDER_CANCELLED: { title: 'Order cancelled', body: 'An order was cancelled.' },
      ORDER_COMPLETED: { title: 'Order complete', body: 'Your transaction is complete.' },
      ORDER_CONFIRMED: { title: 'Order confirmed', body: 'The seller confirmed your order.' },
      ORDER_DELIVERED: { title: 'Delivery confirmed', body: 'The buyer confirmed delivery.' },
      ORDER_SHIPPED: { title: 'Order shipped', body: 'Your order is on the way.' },
    };
    const content = copy[outbox.eventType];
    return this.client.notification.upsert({
      create: {
        actorUserId: outbox.actorUserId,
        body: content.body,
        conversationId: outbox.conversationId,
        dedupeKey: outbox.dedupeKey,
        listingId: outbox.listingId,
        orderId: outbox.orderId,
        recipientId: outbox.recipientId,
        title: content.title,
        type: outbox.eventType,
      },
      update: {},
      where: { dedupeKey: outbox.dedupeKey },
    });
  }
}
