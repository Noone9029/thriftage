import { Logger } from '@nestjs/common';

export interface MarketplaceEvent {
  readonly actorId?: string;
  readonly categoryId?: string;
  readonly listingId?: string;
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
    | 'seller_followed';
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
