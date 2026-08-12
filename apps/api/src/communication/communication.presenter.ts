import { Inject, Injectable } from '@nestjs/common';
import {
  adminConversationDetailSchema,
  conversationDetailSchema,
  conversationSummarySchema,
  messageFlagSchema,
  messageSchema,
  type AdminConversationDetail,
  type ConversationDetail,
  type ConversationSummary,
  type Message,
  type MessageFlag,
} from '@thriftage/shared';

import {
  LISTING_IMAGE_STORAGE,
  type ListingImageStorage,
} from '../listing-media/listing-image-storage.interface';
import type {
  CommunicationRepository,
  ConversationRecord,
  MessageRecord,
} from './communication.repository';

@Injectable()
export class CommunicationPresenter {
  public constructor(
    @Inject(LISTING_IMAGE_STORAGE) private readonly storage: ListingImageStorage,
  ) {}

  public message(record: MessageRecord): Message {
    return messageSchema.parse({
      body: record.body,
      conversationId: record.conversationId,
      createdAt: record.createdAt.toISOString(),
      id: record.id,
      moderationState: record.moderationState,
      readAt: record.readAt?.toISOString() ?? null,
      senderId: record.senderId,
    });
  }

  public async summary(
    record: ConversationRecord,
    viewerId: string,
    unreadCount: number,
  ): Promise<ConversationSummary> {
    const imageKey = record.listing.images[0]?.storageKey;
    const urls = await this.storage.createSignedUrls(imageKey === undefined ? [] : [imageKey]);
    const counterparty = record.buyerId === viewerId ? record.seller : record.buyer;
    return conversationSummarySchema.parse({
      counterparty: {
        id: counterparty.id,
        profileImageUrl: counterparty.profile?.profileImageUrl ?? null,
        username: counterparty.profile?.username ?? 'unavailable',
      },
      createdAt: record.createdAt.toISOString(),
      id: record.id,
      lastMessage: record.messages[0] === undefined ? null : this.message(record.messages[0]),
      listing: {
        id: record.listing.id,
        imageUrl: imageKey === undefined ? null : (urls.get(imageKey) ?? null),
        status: record.listing.status,
        title: record.listing.title,
      },
      unreadCount,
      updatedAt: record.updatedAt.toISOString(),
    });
  }

  public async detail(
    record: ConversationRecord,
    viewerId: string,
    unreadCount: number,
  ): Promise<ConversationDetail> {
    const summary = await this.summary(record, viewerId, unreadCount);
    return conversationDetailSchema.parse({
      ...summary,
      buyer: {
        id: record.buyer.id,
        profileImageUrl: record.buyer.profile?.profileImageUrl ?? null,
        username: record.buyer.profile?.username ?? 'unavailable',
      },
      seller: {
        id: record.seller.id,
        profileImageUrl: record.seller.profile?.profileImageUrl ?? null,
        username: record.seller.profile?.username ?? 'unavailable',
      },
    });
  }

  public flag(
    record: Awaited<ReturnType<CommunicationRepository['listFlags']>>[number],
  ): MessageFlag {
    return messageFlagSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      message: this.message(record.message),
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
    });
  }

  public async adminDetail(
    record: Awaited<ReturnType<CommunicationRepository['getAdminConversation']>>,
  ): Promise<AdminConversationDetail> {
    return adminConversationDetailSchema.parse({
      audits: record.audits.map((audit) => ({
        action: audit.action,
        actorId: audit.actorId,
        createdAt: audit.createdAt.toISOString(),
        id: audit.id,
        reason: audit.reason,
      })),
      conversation: await this.detail(record.conversation, record.conversation.buyerId, 0),
      messages: record.messages.map((message) => this.message(message)),
    });
  }
}
