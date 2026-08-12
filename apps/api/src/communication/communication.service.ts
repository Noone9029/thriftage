import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  conversationPageSchema,
  conversationRealtimeEventSchema,
  conversationStartInputSchema,
  cursorPageQuerySchema,
  messageFlagPageSchema,
  messageFlagQuerySchema,
  messageFlagReviewInputSchema,
  messagePageSchema,
  messageSendInputSchema,
  type AdminConversationDetail,
  type ConversationDetail,
  type ConversationPage,
  type ConversationStartInput,
  type Message,
  type MessageFlag,
  type MessageFlagReviewInput,
  type MessagePage,
  type MessageSendInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { CommunicationDomainError, mapCommunicationError } from './communication.errors';
import { CommunicationPresenter } from './communication.presenter';
import { CommunicationRepository } from './communication.repository';
import { ContactInformationDetector } from './contact-information-detector';
import { REALTIME_PUBLISHER, type RealtimePublisher } from './realtime-publisher.interface';
import { PolicyService } from '../trust/policy.service';
import { SafetyService } from '../trust/safety.service';

const pageCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  public constructor(
    @Inject(CommunicationRepository) private readonly repository: CommunicationRepository,
    @Inject(CommunicationPresenter) private readonly presenter: CommunicationPresenter,
    @Inject(ContactInformationDetector) private readonly detector: ContactInformationDetector,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
    @Inject(PolicyService) private readonly policies: PolicyService,
    @Inject(SafetyService) private readonly safety: SafetyService,
  ) {}

  public async start(userId: string, input: ConversationStartInput): Promise<ConversationDetail> {
    try {
      const parsed = conversationStartInputSchema.parse(input);
      await this.policies.assertUgcAccepted(userId);
      await this.safety.assertScopeAllowed(userId, 'MESSAGING');
      await this.safety.assertListingPairAllowed(userId, parsed.listingId);
      const record = await this.repository.startConversation(userId, parsed.listingId);
      this.events.publish({
        actorId: userId,
        conversationId: record.id,
        listingId: parsed.listingId,
        name: 'conversation_started',
      });
      return this.presenter.detail(record, userId, 0);
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async list(userId: string, queryInput: unknown): Promise<ConversationPage> {
    try {
      const query = cursorPageQuerySchema.parse(queryInput);
      const cursor = decodeCursor(query.cursor, pageCursorSchema);
      const result = await this.repository.listConversations(
        userId,
        query.limit,
        cursor === null ? undefined : { id: cursor.id, updatedAt: new Date(cursor.createdAt) },
      );
      const items = await Promise.all(
        result.records.map((record, index) =>
          this.presenter.summary(record, userId, result.counts[index] ?? 0),
        ),
      );
      const last = result.records.at(-1);
      return conversationPageSchema.parse({
        items,
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({ createdAt: last.updatedAt.toISOString(), id: last.id })
            : null,
        totalUnread: result.totalUnread,
      });
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async get(userId: string, conversationId: string): Promise<ConversationDetail> {
    try {
      return this.presenter.detail(
        await this.repository.findParticipantConversation(userId, conversationId),
        userId,
        0,
      );
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async messages(
    userId: string,
    conversationId: string,
    queryInput: unknown,
  ): Promise<MessagePage> {
    try {
      const query = cursorPageQuerySchema.parse(queryInput);
      const cursor = decodeCursor(query.cursor, pageCursorSchema);
      const result = await this.repository.listMessages(
        userId,
        conversationId,
        query.limit,
        cursor === null ? undefined : { createdAt: new Date(cursor.createdAt), id: cursor.id },
      );
      const last = result.records.at(-1);
      return messagePageSchema.parse({
        items: result.records.map((record) => this.presenter.message(record)),
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      });
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async send(
    userId: string,
    conversationId: string,
    input: MessageSendInput,
  ): Promise<Message> {
    try {
      const parsed = messageSendInputSchema.parse(input);
      await this.policies.assertUgcAccepted(userId);
      await this.safety.assertScopeAllowed(userId, 'MESSAGING');
      const conversation = await this.repository.findParticipantConversation(
        userId,
        conversationId,
      );
      const counterpartId =
        conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
      await this.safety.assertPairAllowed(userId, counterpartId);
      const detections = this.detector.inspect(parsed.body);
      const result = await this.repository.sendMessage(
        userId,
        conversationId,
        parsed.body,
        detections,
      );
      if (result.blocked) {
        this.events.publish({ actorId: userId, conversationId, name: 'message_contact_blocked' });
        throw new CommunicationDomainError('MESSAGE_CONTACT_SHARING_BLOCKED');
      }
      this.events.publish({
        actorId: userId,
        conversationId,
        name: detections.length > 0 ? 'message_flagged' : 'message_sent',
      });
      const message = this.presenter.message(result.message);
      void this.realtime
        .publishMessage(
          conversationRealtimeEventSchema.parse({
            conversationId,
            createdAt: message.createdAt,
            messageId: message.id,
          }),
        )
        .catch(() =>
          this.logger.warn(
            `Realtime delivery deferred: conversationId=${conversationId} messageId=${message.id}`,
          ),
        );
      return message;
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async markRead(
    userId: string,
    conversationId: string,
  ): Promise<{ readonly markedRead: number }> {
    try {
      return { markedRead: await this.repository.markRead(userId, conversationId) };
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async listFlags(queryInput: unknown) {
    try {
      const query = messageFlagQuerySchema.parse(queryInput);
      const records = await this.repository.listFlags(query.status, query.limit);
      return messageFlagPageSchema.parse({
        items: records.map((record) => this.presenter.flag(record)),
        nextCursor: null,
      });
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async reviewFlag(
    adminId: string,
    flagId: string,
    input: MessageFlagReviewInput,
  ): Promise<MessageFlag> {
    try {
      return this.presenter.flag(
        await this.repository.reviewFlag(
          adminId,
          flagId,
          messageFlagReviewInputSchema.parse(input),
        ),
      );
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }

  public async adminConversation(
    adminId: string,
    conversationId: string,
  ): Promise<AdminConversationDetail> {
    try {
      return this.presenter.adminDetail(
        await this.repository.getAdminConversation(adminId, conversationId),
      );
    } catch (error: unknown) {
      throw mapCommunicationError(error);
    }
  }
}
