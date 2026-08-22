import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  feedQuerySchema,
  listingDraftInputSchema,
  listingSearchQuerySchema,
  listingUpdateInputSchema,
  sellerListingQuerySchema,
  type ListingDetail,
  type ListingDraftInput,
  type ListingPage,
  type ListingSearchQuery,
  type ListingUpdateInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { mapMarketplaceError, MarketplaceDomainError } from '../common/marketplace.errors';
import {
  LISTING_IMAGE_STORAGE,
  type ListingImageStorage,
} from '../listing-media/listing-image-storage.interface';
import { ListingPresenter } from './listing.presenter';
import { PolicyService } from '../trust/policy.service';
import { SafetyService } from '../trust/safety.service';
import {
  ListingRepository,
  type ChronologicalCursor,
  type ListingRecord,
  type SearchCursor,
} from './listing.repository';
import { PersonalizationService } from '../personalization/personalization.service';

const searchCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.literal('SEARCH'),
  priceMinor: z.number().int().positive().optional(),
  sort: z.enum(['NEWEST', 'OLDEST', 'PRICE_LOW', 'PRICE_HIGH', 'PERSONALIZED']),
});

const chronologicalCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.literal('CHRONOLOGICAL'),
});

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  public constructor(
    @Inject(ListingRepository) private readonly repository: ListingRepository,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
    @Inject(LISTING_IMAGE_STORAGE) private readonly storage: ListingImageStorage,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
    @Inject(PolicyService) private readonly policies: PolicyService,
    @Inject(SafetyService) private readonly safety: SafetyService,
    @Inject(PersonalizationService) private readonly personalization: PersonalizationService,
  ) {}

  public async create(userId: string, input: ListingDraftInput): Promise<ListingDetail> {
    try {
      const record = await this.repository.createDraft(
        userId,
        listingDraftInputSchema.parse(input),
      );
      this.events.publish({
        actorId: userId,
        categoryId: record.categoryId,
        listingId: record.id,
        name: 'listing_draft_created',
      });
      return this.presentOne(record, userId);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async update(
    userId: string,
    listingId: string,
    input: ListingUpdateInput,
  ): Promise<ListingDetail> {
    try {
      return this.presentOne(
        await this.repository.updateDraft(userId, listingId, listingUpdateInputSchema.parse(input)),
        userId,
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async deleteDraft(userId: string, listingId: string): Promise<void> {
    try {
      const storageKeys = await this.repository.deleteDraft(userId, listingId);
      try {
        await this.storage.remove(storageKeys);
      } catch {
        this.logger.error(
          `Private listing media cleanup failed after draft deletion: listingId=${listingId}`,
        );
      }
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async submit(userId: string, listingId: string): Promise<ListingDetail> {
    try {
      await this.policies.assertUgcAccepted(userId);
      await this.safety.assertScopeAllowed(userId, 'SELLING');
      const record = await this.repository.submit(userId, listingId);
      this.events.publish({
        actorId: userId,
        categoryId: record.categoryId,
        listingId,
        name: 'listing_submitted',
      });
      return this.presentOne(record, userId);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async archive(userId: string, listingId: string): Promise<ListingDetail> {
    try {
      const record = await this.repository.archive(userId, listingId);
      this.events.publish({ actorId: userId, listingId, name: 'listing_archived' });
      return this.presentOne(record, userId);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async getMine(userId: string, listingId: string): Promise<ListingDetail> {
    try {
      const record = await this.repository.findOwned(userId, listingId);
      if (record === null) throw new MarketplaceDomainError('LISTING_NOT_FOUND');
      return this.presentOne(record, userId);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async getPublic(listingId: string, viewerId?: string): Promise<ListingDetail> {
    try {
      const record = await this.repository.findPublic(listingId);
      if (record === null) throw new MarketplaceDomainError('LISTING_NOT_PUBLIC');
      if (viewerId !== undefined) await this.safety.assertPairAllowed(viewerId, record.sellerId);
      this.events.publish({
        ...(viewerId === undefined ? {} : { actorId: viewerId }),
        listingId,
        name: 'listing_viewed',
      });
      const match =
        viewerId === undefined
          ? null
          : await this.personalization.matchForListing(viewerId, listingId);
      if (viewerId !== undefined) {
        void this.personalization
          .recordEvent(viewerId, { listingId, source: 'LISTING_DETAIL', type: 'VIEW' })
          .catch(() =>
            this.logger.warn(`Recommendation view event was not recorded: listingId=${listingId}`),
          );
      }
      const state = this.repository.getViewerState(viewerId, [record.id]);
      const [presented] = await this.presenter.presentMany(
        [record],
        state,
        match === null ? new Map() : new Map([[listingId, match]]),
      );
      if (presented === undefined) throw new MarketplaceDomainError('MARKETPLACE_SERVICE_ERROR');
      return presented;
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async similar(listingId: string, viewerId?: string): Promise<ListingPage> {
    try {
      const ids = await this.personalization.similarListingIds(viewerId, listingId, 12);
      const records = await this.repository.findByIds(ids);
      return this.presentPage(records, false, viewerId, this.encodeChronologicalCursor);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async search(queryInput: unknown, viewerId?: string): Promise<ListingPage> {
    try {
      const query = listingSearchQuerySchema.parse(queryInput);
      const cursor = this.parseSearchCursor(query, query.cursor);
      const result = await this.repository.search(query, cursor, viewerId);
      if (query.sort === 'PERSONALIZED' && viewerId !== undefined) {
        const ranked = await this.personalization.rankForYou(viewerId, new Date());
        const rankIndex = new Map(ranked.ranked.map((item, index) => [item.id, index]));
        const matches = new Map(
          ranked.ranked
            .filter(({ match }) => match.contributions.length > 0)
            .map(({ id, match }) => [id, match]),
        );
        const displayRecords = [...result.records].sort(
          (left, right) =>
            (rankIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
              (rankIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
            left.id.localeCompare(right.id),
        );
        const state = this.repository.getViewerState(
          viewerId,
          displayRecords.map(({ id }) => id),
        );
        const items = await this.presenter.presentMany(displayRecords, state, matches);
        const cursorRecord = result.records.at(-1);
        return {
          items,
          nextCursor:
            result.hasMore && cursorRecord !== undefined
              ? encodeCursor({
                  createdAt: cursorRecord.createdAt.toISOString(),
                  id: cursorRecord.id,
                  kind: 'SEARCH',
                  sort: query.sort,
                })
              : null,
        };
      }
      return this.presentPage(result.records, result.hasMore, viewerId, (last) =>
        encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
          kind: 'SEARCH',
          ...(query.sort === 'PRICE_LOW' || query.sort === 'PRICE_HIGH'
            ? { priceMinor: last.priceMinor }
            : {}),
          sort: query.sort,
        }),
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async listMine(userId: string, queryInput: unknown): Promise<ListingPage> {
    try {
      const query = sellerListingQuerySchema.parse(queryInput);
      const cursor = this.parseChronologicalCursor(query.cursor);
      const result = await this.repository.listOwned(userId, query, cursor);
      return this.presentPage(
        result.records,
        result.hasMore,
        userId,
        this.encodeChronologicalCursor,
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async listPublicBySeller(
    sellerId: string,
    queryInput: unknown,
    viewerId?: string,
  ): Promise<ListingPage> {
    try {
      const query = feedQuerySchema.pick({ cursor: true, limit: true }).parse(queryInput);
      const cursor = this.parseChronologicalCursor(query.cursor);
      const result = await this.repository.listPublicBySeller(sellerId, query.limit, cursor);
      return this.presentPage(
        result.records,
        result.hasMore,
        viewerId,
        this.encodeChronologicalCursor,
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  private async presentOne(record: ListingRecord, viewerId?: string): Promise<ListingDetail> {
    const state = this.repository.getViewerState(viewerId, [record.id]);
    const [presented] = await this.presenter.presentMany([record], state);
    if (presented === undefined) throw new MarketplaceDomainError('MARKETPLACE_SERVICE_ERROR');
    return presented;
  }

  private async presentPage(
    records: readonly ListingRecord[],
    hasMore: boolean,
    viewerId: string | undefined,
    encode: (last: ListingRecord) => string,
  ): Promise<ListingPage> {
    const state = this.repository.getViewerState(
      viewerId,
      records.map(({ id }) => id),
    );
    const items = await this.presenter.presentMany(records, state);
    const last = records.at(-1);
    return { items, nextCursor: hasMore && last !== undefined ? encode(last) : null };
  }

  private parseSearchCursor(
    query: ListingSearchQuery,
    raw: string | undefined,
  ): SearchCursor | null {
    const cursor = decodeCursor(raw, searchCursorSchema);
    if (cursor === null) return null;
    if (cursor.sort !== query.sort) throw new MarketplaceDomainError('VALIDATION_FAILED');
    return {
      createdAt: new Date(cursor.createdAt),
      id: cursor.id,
      ...(cursor.priceMinor === undefined ? {} : { priceMinor: cursor.priceMinor }),
    };
  }

  private parseChronologicalCursor(raw: string | undefined): ChronologicalCursor | null {
    const cursor = decodeCursor(raw, chronologicalCursorSchema);
    return cursor === null ? null : { createdAt: new Date(cursor.createdAt), id: cursor.id };
  }

  private readonly encodeChronologicalCursor = (last: ListingRecord): string =>
    encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id, kind: 'CHRONOLOGICAL' });
}
