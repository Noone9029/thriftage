import { Inject, Injectable } from '@nestjs/common';
import { feedQuerySchema, type FeedQuery, type ListingPage } from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import { mapMarketplaceError, MarketplaceDomainError } from '../common/marketplace.errors';
import { ListingPresenter } from '../listings/listing.presenter';
import { ListingRepository } from '../listings/listing.repository';
import { DiscoveryRepository, type DiscoveryCursor } from './discovery.repository';
import { PersonalizationService } from '../personalization/personalization.service';

const discoveryCursorSchema = z.strictObject({
  asOf: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.literal('DISCOVERY'),
  mode: z.enum(['NEW', 'TRENDING', 'RECOMMENDED']),
  score: z.number().int().nonnegative(),
});

const personalizedCursorSchema = z.strictObject({
  asOf: z.string().datetime({ offset: true }),
  configurationVersion: z.string().min(1).max(40),
  kind: z.literal('PERSONALIZED'),
  mode: z.literal('RECOMMENDED'),
  offset: z.number().int().nonnegative(),
  profileVersion: z.number().int().positive(),
});

@Injectable()
export class DiscoveryService {
  public constructor(
    @Inject(DiscoveryRepository) private readonly discovery: DiscoveryRepository,
    @Inject(ListingRepository) private readonly listings: ListingRepository,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
    @Inject(PersonalizationService) private readonly personalization: PersonalizationService,
  ) {}

  public async feed(queryInput: unknown, viewerId?: string): Promise<ListingPage> {
    try {
      const query = feedQuerySchema.parse(queryInput);
      if (query.mode === 'RECOMMENDED' && viewerId !== undefined) {
        return await this.personalizedFeed(query, viewerId);
      }
      const cursor = this.parseCursor(query, query.cursor);
      const asOf = cursor?.asOf ?? new Date();
      if (query.mode === 'NEW') {
        const result = await this.listings.listNewFeed(
          viewerId,
          asOf,
          cursor === null ? null : { createdAt: cursor.createdAt, id: cursor.id },
          query.limit,
        );
        const state = this.listings.getViewerState(
          viewerId,
          result.records.map(({ id }) => id),
        );
        const items = await this.presenter.presentMany(result.records, state);
        const last = result.records.at(-1);
        return {
          items,
          nextCursor:
            result.hasMore && last !== undefined
              ? encodeCursor({
                  asOf: asOf.toISOString(),
                  createdAt: last.createdAt.toISOString(),
                  id: last.id,
                  kind: 'DISCOVERY',
                  mode: query.mode,
                  score: 0,
                })
              : null,
        };
      }
      const result = await this.discovery.rank(query.mode, viewerId, asOf, cursor, query.limit);
      const records = await this.listings.findByIds(result.ranks.map(({ id }) => id));
      const state = this.listings.getViewerState(
        viewerId,
        records.map(({ id }) => id),
      );
      const items = await this.presenter.presentMany(records, state);
      const last = result.ranks.at(-1);
      return {
        items,
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({
                asOf: asOf.toISOString(),
                createdAt: last.createdAt.toISOString(),
                id: last.id,
                kind: 'DISCOVERY',
                mode: query.mode,
                score: last.score,
              })
            : null,
      };
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  private async personalizedFeed(query: FeedQuery, viewerId: string): Promise<ListingPage> {
    const cursor = decodeCursor(query.cursor, personalizedCursorSchema);
    const asOf = cursor === null ? new Date() : new Date(cursor.asOf);
    const result = await this.personalization.rankForYou(viewerId, asOf);
    if (
      cursor !== null &&
      (cursor.configurationVersion !== result.configurationVersion ||
        cursor.profileVersion !== result.profileVersion)
    ) {
      throw new MarketplaceDomainError('VALIDATION_FAILED');
    }
    const offset = cursor?.offset ?? 0;
    const page = result.ranked.slice(offset, offset + query.limit);
    const records = await this.listings.findByIds(page.map(({ id }) => id));
    const state = this.listings.getViewerState(
      viewerId,
      records.map(({ id }) => id),
    );
    const matches = new Map(
      page
        .filter(({ match }) => match.contributions.length > 0)
        .map(({ id, match }) => [id, match]),
    );
    const items = await this.presenter.presentMany(records, state, matches);
    void this.personalization
      .recordImpressions(
        viewerId,
        page
          .filter(({ match }) => match.contributions.length > 0)
          .map(({ id, match }) => ({ id, matchScore: match.score })),
        result.configurationVersion,
      )
      .catch(() => undefined);
    const nextOffset = offset + page.length;
    return {
      items,
      nextCursor:
        nextOffset < result.ranked.length
          ? encodeCursor({
              asOf: asOf.toISOString(),
              configurationVersion: result.configurationVersion,
              kind: 'PERSONALIZED',
              mode: 'RECOMMENDED',
              offset: nextOffset,
              profileVersion: result.profileVersion,
            })
          : null,
    };
  }

  private parseCursor(query: FeedQuery, raw: string | undefined): DiscoveryCursor | null {
    const cursor = decodeCursor(raw, discoveryCursorSchema);
    if (cursor === null) return null;
    if (cursor.mode !== query.mode) throw new MarketplaceDomainError('VALIDATION_FAILED');
    return {
      asOf: new Date(cursor.asOf),
      createdAt: new Date(cursor.createdAt),
      id: cursor.id,
      mode: cursor.mode,
      score: cursor.score,
    };
  }
}
