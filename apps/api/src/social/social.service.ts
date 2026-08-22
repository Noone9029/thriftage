import { Inject, Injectable } from '@nestjs/common';
import {
  cursorPageQuerySchema,
  sellerProfileSchema,
  sellerProfileWithListingsSchema,
  socialActionResultSchema,
  usernameSchema,
  type ListingPage,
  type SellerProfileWithListings,
  type SocialActionResult,
} from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { mapMarketplaceError, MarketplaceDomainError } from '../common/marketplace.errors';
import { ListingPresenter } from '../listings/listing.presenter';
import { ListingRepository } from '../listings/listing.repository';
import { ListingService } from '../listings/listing.service';
import { SocialRepository, type SavedCursor } from './social.repository';
import { PolicyService } from '../trust/policy.service';
import { SafetyService } from '../trust/safety.service';
import { ReputationReader } from '../trust/reputation.reader';
import { PersonalizationService } from '../personalization/personalization.service';

const savedCursorSchema = z.strictObject({
  kind: z.literal('SAVED'),
  listingId: z.string().uuid(),
  savedAt: z.string().datetime({ offset: true }),
});

@Injectable()
export class SocialService {
  public constructor(
    @Inject(SocialRepository) private readonly social: SocialRepository,
    @Inject(ListingRepository) private readonly listings: ListingRepository,
    @Inject(ListingService) private readonly listingService: ListingService,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
    @Inject(PolicyService) private readonly policies: PolicyService,
    @Inject(SafetyService) private readonly safety: SafetyService,
    @Inject(ReputationReader) private readonly reputation: ReputationReader,
    @Inject(PersonalizationService) private readonly personalization: PersonalizationService,
  ) {}

  public setLike(userId: string, listingId: string, active: boolean): Promise<SocialActionResult> {
    return this.setListingInteraction(userId, listingId, active, 'LIKE');
  }

  public setSaved(userId: string, listingId: string, active: boolean): Promise<SocialActionResult> {
    return this.setListingInteraction(userId, listingId, active, 'SAVE');
  }

  public async setFollow(
    userId: string,
    targetUserId: string,
    active: boolean,
  ): Promise<SocialActionResult> {
    try {
      await this.policies.assertUgcAccepted(userId);
      await this.safety.assertScopeAllowed(userId, 'SOCIAL');
      await this.safety.assertPairAllowed(userId, targetUserId);
      const result = await this.social.setFollow(userId, targetUserId, active);
      if (result.changed && active) {
        this.events.publish({ actorId: userId, name: 'seller_followed', targetUserId });
      }
      return socialActionResultSchema.parse({ active: result.active, count: result.count });
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async getSeller(
    usernameInput: string,
    queryInput: unknown,
    viewerId?: string,
  ): Promise<SellerProfileWithListings> {
    try {
      const username = usernameSchema.parse(usernameInput);
      const profileRecord = await this.social.findSellerProfile(username, viewerId);
      if (profileRecord === null) throw new MarketplaceDomainError('SELLER_NOT_FOUND');
      if (viewerId !== undefined) await this.safety.assertPairAllowed(viewerId, profileRecord.id);
      const [sellerRatings, buyerRatings, verified] = await Promise.all([
        this.reputation.summaries([profileRecord.id], 'BUYER_TO_SELLER'),
        this.reputation.summaries([profileRecord.id], 'SELLER_TO_BUYER'),
        this.reputation.verified([profileRecord.id]),
      ]);
      const profile = sellerProfileSchema.parse({
        ...profileRecord,
        memberSince: profileRecord.memberSince.toISOString(),
        sellerRating: sellerRatings.get(profileRecord.id),
        buyerRating: buyerRatings.get(profileRecord.id),
        sellerVerified: verified.has(profileRecord.id),
      });
      const listings = await this.listingService.listPublicBySeller(
        profileRecord.id,
        queryInput,
        viewerId,
      );
      return sellerProfileWithListingsSchema.parse({ listings, profile });
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async listSaved(userId: string, queryInput: unknown): Promise<ListingPage> {
    try {
      const query = cursorPageQuerySchema.parse(queryInput);
      const parsed = decodeCursor(query.cursor, savedCursorSchema);
      const cursor: SavedCursor | null =
        parsed === null ? null : { listingId: parsed.listingId, savedAt: new Date(parsed.savedAt) };
      const excludedSellerIds = await this.safety.blockedCounterpartIds(userId);
      const result = await this.social.listSaved(userId, query.limit, cursor, excludedSellerIds);
      const state = this.listings.getViewerState(
        userId,
        result.records.map(({ id }) => id),
      );
      const items = await this.presenter.presentMany(result.records, state);
      const last = result.rows.at(-1);
      return {
        items,
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({
                kind: 'SAVED',
                listingId: last.listingId,
                savedAt: last.savedAt.toISOString(),
              })
            : null,
      };
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  private async setListingInteraction(
    userId: string,
    listingId: string,
    active: boolean,
    type: 'LIKE' | 'SAVE',
  ): Promise<SocialActionResult> {
    try {
      await this.policies.assertUgcAccepted(userId);
      await this.safety.assertScopeAllowed(userId, 'SOCIAL');
      await this.safety.assertListingPairAllowed(userId, listingId);
      const result =
        type === 'LIKE'
          ? await this.social.setLike(userId, listingId, active)
          : await this.social.setSaved(userId, listingId, active);
      if (result.changed && active) {
        this.events.publish({
          actorId: userId,
          listingId,
          name: type === 'LIKE' ? 'item_liked' : 'item_saved',
        });
        void this.personalization
          .recordEvent(userId, {
            listingId,
            source: 'LISTING_DETAIL',
            type,
          })
          .catch(() => undefined);
      }
      return socialActionResultSchema.parse({ active: result.active, count: result.count });
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }
}
