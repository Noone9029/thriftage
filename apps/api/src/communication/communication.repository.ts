import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  type MessageFlagStatus,
  type Prisma,
  type PrismaClient,
} from '@thriftage/db';
import type { MessageFlagReviewInput } from '@thriftage/shared';

import { CommunicationDomainError } from './communication.errors';
import type { ContactDetection } from './contact-information-detector';

export const conversationArgs = {
  include: {
    buyer: { include: { profile: true } },
    listing: { include: { images: { orderBy: { position: 'asc' as const }, take: 1 } } },
    messages: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: 1 },
    seller: { include: { profile: true } },
  },
} as const satisfies Prisma.ConversationDefaultArgs;

export type ConversationRecord = Prisma.ConversationGetPayload<typeof conversationArgs>;
export type MessageRecord = Prisma.MessageGetPayload<Record<string, never>>;

@Injectable()
export class CommunicationRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async startConversation(userId: string, listingId: string): Promise<ConversationRecord> {
    const listing = await this.client.listing.findFirst({
      select: { id: true, sellerId: true, status: true },
      where: { id: listingId, status: 'ACTIVE' },
    });
    if (listing === null) throw new CommunicationDomainError('CONVERSATION_NOT_FOUND');
    if (listing.sellerId === userId) throw new CommunicationDomainError('CONVERSATION_FORBIDDEN');
    const existing = await this.client.conversation.findUnique({
      ...conversationArgs,
      where: { listingId_buyerId: { buyerId: userId, listingId } },
    });
    if (existing !== null) return existing;
    const startsToday = await this.client.conversation.count({
      where: { buyerId: userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    const maxStarts = Number(process.env.CONVERSATION_MAX_STARTS_PER_DAY ?? 25);
    if (startsToday >= maxStarts) throw new CommunicationDomainError('MESSAGE_RATE_LIMITED');
    return this.client.conversation.upsert({
      ...conversationArgs,
      create: { buyerId: userId, listingId, sellerId: listing.sellerId },
      update: {},
      where: { listingId_buyerId: { buyerId: userId, listingId } },
    });
  }

  public async findParticipantConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationRecord> {
    const record = await this.client.conversation.findFirst({
      ...conversationArgs,
      where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    });
    if (record === null) throw new CommunicationDomainError('CONVERSATION_NOT_FOUND');
    return record;
  }

  public async listConversations(
    userId: string,
    limit: number,
    cursor?: { readonly id: string; readonly updatedAt: Date },
  ) {
    const records = await this.client.conversation.findMany({
      ...conversationArgs,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        ...(cursor === undefined
          ? {}
          : {
              AND: [
                {
                  OR: [
                    { updatedAt: { lt: cursor.updatedAt } },
                    { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
                  ],
                },
              ],
            }),
      },
    });
    const page = records.slice(0, limit);
    const counts = await Promise.all(
      page.map((conversation) =>
        this.client.message.count({
          where: {
            conversationId: conversation.id,
            readAt: null,
            senderId: { not: userId },
            moderationState: { not: 'BLOCKED' },
          },
        }),
      ),
    );
    const totalUnread = await this.client.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        moderationState: { not: 'BLOCKED' },
        conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      },
    });
    return { counts, hasMore: records.length > limit, records: page, totalUnread };
  }

  public async listMessages(
    userId: string,
    conversationId: string,
    limit: number,
    cursor?: { readonly id: string; readonly createdAt: Date },
  ) {
    await this.findParticipantConversation(userId, conversationId);
    const records = await this.client.message.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        conversationId,
        OR: [{ moderationState: { not: 'BLOCKED' } }, { senderId: userId }],
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
    return { hasMore: records.length > limit, records: records.slice(0, limit) };
  }

  public async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
    detections: readonly ContactDetection[],
  ) {
    return this.client.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.findFirst({
        select: { buyerId: true, sellerId: true },
        where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
      });
      if (conversation === null) throw new CommunicationDomainError('CONVERSATION_NOT_FOUND');
      const minuteAgo = new Date(Date.now() - 60_000);
      const sends = await transaction.message.count({
        where: { senderId: userId, createdAt: { gte: minuteAgo } },
      });
      if (sends >= Number(process.env.MESSAGE_MAX_SENDS_PER_MINUTE ?? 20)) {
        throw new CommunicationDomainError('MESSAGE_RATE_LIMITED');
      }
      const blocked = detections.some((detection) => detection.blocked);
      if (blocked) {
        const blockedCount = await transaction.message.count({
          where: {
            senderId: userId,
            moderationState: 'BLOCKED',
            createdAt: { gte: new Date(Date.now() - 3_600_000) },
          },
        });
        if (blockedCount >= Number(process.env.MESSAGE_MAX_BLOCKED_PER_HOUR ?? 10)) {
          throw new CommunicationDomainError('MESSAGE_RATE_LIMITED');
        }
      }
      const message = await transaction.message.create({
        data: {
          body,
          conversationId,
          moderationState: blocked ? 'BLOCKED' : detections.length > 0 ? 'FLAGGED' : 'CLEAR',
          senderId: userId,
          flags: {
            create: detections.map((detection) => ({
              blocked: detection.blocked,
              category: detection.category,
              confidence: detection.confidence,
              conversationId,
              detector: detection.detector,
              requiresReview: true,
            })),
          },
        },
      });
      if (!blocked) {
        const recipientId =
          conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
        await transaction.conversation.update({
          data: { lastMessageAt: message.createdAt },
          where: { id: conversationId },
        });
        await transaction.notificationOutbox.create({
          data: {
            actorUserId: userId,
            conversationId,
            dedupeKey: `new-message:${message.id}`,
            eventType: 'NEW_MESSAGE',
            messageId: message.id,
            recipientId,
          },
        });
      }
      return { blocked, message };
    });
  }

  public async markRead(userId: string, conversationId: string): Promise<number> {
    await this.findParticipantConversation(userId, conversationId);
    const result = await this.client.message.updateMany({
      data: { readAt: new Date() },
      where: {
        conversationId,
        readAt: null,
        senderId: { not: userId },
        moderationState: { not: 'BLOCKED' },
      },
    });
    return result.count;
  }

  public async listFlags(status: MessageFlagStatus | undefined, limit: number) {
    return this.client.messageModerationFlag.findMany({
      include: { message: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      where: status === undefined ? {} : { status },
    });
  }

  public async reviewFlag(adminId: string, flagId: string, input: MessageFlagReviewInput) {
    return this.client.$transaction(async (transaction) => {
      const flag = await transaction.messageModerationFlag.findUnique({ where: { id: flagId } });
      if (flag === null) throw new CommunicationDomainError('MESSAGE_FLAG_NOT_FOUND');
      const updated = await transaction.messageModerationFlag.update({
        data: {
          reviewerId: adminId,
          ...(input.resolution === undefined ? {} : { resolution: input.resolution }),
          reviewedAt: input.status === 'UNDER_REVIEW' ? null : new Date(),
          status: input.status,
        },
        include: { message: true },
        where: { id: flagId },
      });
      await transaction.messageModerationAudit.create({
        data: {
          action: `FLAG_${input.status}`,
          actorId: adminId,
          conversationId: flag.conversationId,
          flagId,
          ...(input.resolution === undefined ? {} : { reason: input.resolution }),
        },
      });
      return updated;
    });
  }

  public async getAdminConversation(adminId: string, conversationId: string) {
    return this.client.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.findUnique({
        ...conversationArgs,
        where: { id: conversationId },
      });
      if (conversation === null) throw new CommunicationDomainError('CONVERSATION_NOT_FOUND');
      const [messages, audits] = await Promise.all([
        transaction.message.findMany({
          orderBy: { createdAt: 'asc' },
          take: 100,
          where: { conversationId },
        }),
        transaction.messageModerationAudit.findMany({
          orderBy: { createdAt: 'desc' },
          where: { conversationId },
        }),
      ]);
      await transaction.messageModerationAudit.create({
        data: { action: 'CONVERSATION_VIEWED', actorId: adminId, conversationId },
      });
      return { audits, conversation, messages };
    });
  }
}
