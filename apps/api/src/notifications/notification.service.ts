import { Inject, Injectable } from '@nestjs/common';
import {
  notificationPageSchema,
  notificationSchema,
  pushDeviceInputSchema,
  pushDeviceSchema,
  type NotificationPage,
  type PushDevice,
  type PushDeviceInput,
} from '@thriftage/shared';

import { mapNotificationError } from './notification.errors';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationService {
  public constructor(
    @Inject(NotificationRepository) private readonly repository: NotificationRepository,
  ) {}
  public async list(
    userId: string,
    input: { readonly limit?: unknown },
  ): Promise<NotificationPage> {
    try {
      const limit = typeof input.limit === 'string' ? Number(input.limit) : 20;
      const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
      const [records, unreadCount] = await Promise.all([
        this.repository.list(userId, safeLimit),
        this.repository.unreadCount(userId),
      ]);
      return notificationPageSchema.parse({
        items: records.map((record) =>
          notificationSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            readAt: record.readAt?.toISOString() ?? null,
          }),
        ),
        nextCursor: null,
        unreadCount,
      });
    } catch (error) {
      throw mapNotificationError(error);
    }
  }
  public async markRead(userId: string, id: string): Promise<void> {
    try {
      await this.repository.markRead(userId, id);
    } catch (error) {
      throw mapNotificationError(error);
    }
  }
  public async markAllRead(userId: string): Promise<{ readonly markedRead: number }> {
    try {
      const result = await this.repository.markAllRead(userId);
      return { markedRead: result.count };
    } catch (error) {
      throw mapNotificationError(error);
    }
  }
  public async register(userId: string, input: PushDeviceInput): Promise<PushDevice> {
    try {
      const record = await this.repository.registerDevice(
        userId,
        pushDeviceInputSchema.parse(input),
      );
      return pushDeviceSchema.parse({
        ...record,
        createdAt: record.createdAt.toISOString(),
        lastSeenAt: record.lastSeenAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      });
    } catch (error) {
      throw mapNotificationError(error);
    }
  }
  public async deactivate(userId: string, id: string): Promise<void> {
    try {
      await this.repository.deactivateDevice(userId, id);
    } catch (error) {
      throw mapNotificationError(error);
    }
  }
}
