import { Logger } from '@nestjs/common';

export interface MarketplaceEvent {
  readonly actorId?: string;
  readonly categoryId?: string;
  readonly listingId?: string;
  readonly conversationId?: string;
  readonly orderId?: string;
  readonly reviewId?: string;
  readonly disputeId?: string;
  readonly sellerVerificationId?: string;
  readonly name:
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
    | 'policy_accepted';
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
