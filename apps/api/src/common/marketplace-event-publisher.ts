import { Logger } from '@nestjs/common';
import { getPrismaClient, type PrismaClient } from '@thriftage/db';

export interface MarketplaceEvent {
  readonly actorId?: string;
  readonly categoryId?: string;
  readonly listingId?: string;
  readonly conversationId?: string;
  readonly orderId?: string;
  readonly reviewId?: string;
  readonly disputeId?: string;
  readonly generationId?: string;
  readonly outfitId?: string;
  readonly sellerVerificationId?: string;
  readonly name:
    | 'user_registered'
    | 'profile_completed'
    | 'item_liked'
    | 'item_saved'
    | 'listing_approved'
    | 'listing_archived'
    | 'listing_draft_created'
    | 'listing_rejected'
    | 'listing_submitted'
    | 'listing_viewed'
    | 'report_submitted'
    | 'seller_followed'
    | 'conversation_started'
    | 'message_contact_blocked'
    | 'message_flagged'
    | 'message_sent'
    | 'checkout_started'
    | 'order_created'
    | 'order_confirmed'
    | 'order_cancelled'
    | 'order_shipped'
    | 'order_delivered'
    | 'order_completed'
    | 'payment_started'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'notification_opened'
    | 'review_submitted'
    | 'review_reported'
    | 'user_blocked'
    | 'user_unblocked'
    | 'dispute_opened'
    | 'dispute_evidence_added'
    | 'dispute_resolved'
    | 'seller_verification_submitted'
    | 'seller_verification_approved'
    | 'seller_verification_rejected'
    | 'restriction_applied'
    | 'policy_accepted'
    | 'ai_stylist_opened'
    | 'ai_message_sent'
    | 'ai_response_completed'
    | 'ai_response_failed'
    | 'ai_outfit_generated'
    | 'ai_outfit_saved'
    | 'ai_outfit_item_opened'
    | 'ai_outfit_item_saved'
    | 'ai_outfit_item_purchased'
    | 'ai_refinement_requested'
    | 'ai_fallback_used';
  readonly targetUserId?: string;
}

export interface MarketplaceEventPublisher {
  publish(event: MarketplaceEvent): void;
}

export const MARKETPLACE_EVENT_PUBLISHER = Symbol('MARKETPLACE_EVENT_PUBLISHER');

export class StructuredLogMarketplaceEventPublisher implements MarketplaceEventPublisher {
  private readonly logger = new Logger('MarketplaceEvents');

  public publish(event: MarketplaceEvent): void {
    this.logger.log({ event });
  }
}

export class PersistentMarketplaceEventPublisher implements MarketplaceEventPublisher {
  private readonly logger = new Logger('MarketplaceEvents');

  public constructor(private readonly prisma?: PrismaClient) {}

  public publish(event: MarketplaceEvent): void {
    this.logger.log({ event });
    const client = this.prisma ?? getPrismaClient();
    void client.marketplaceAnalyticsEvent
      .create({
        data: {
          ...(event.actorId === undefined ? {} : { actorId: event.actorId }),
          ...(event.categoryId === undefined ? {} : { categoryId: event.categoryId }),
          ...(event.conversationId === undefined ? {} : { conversationId: event.conversationId }),
          ...(event.listingId === undefined ? {} : { listingId: event.listingId }),
          name: event.name,
          ...(event.orderId === undefined ? {} : { orderId: event.orderId }),
          ...(event.targetUserId === undefined ? {} : { targetUserId: event.targetUserId }),
        },
      })
      .catch(() =>
        this.logger.warn({ code: 'MARKETPLACE_EVENT_PERSIST_FAILED', name: event.name }),
      );
  }
}
