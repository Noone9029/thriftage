import { Inject, Injectable } from '@nestjs/common';
import { feedQuerySchema, type FeedQuery, type ListingPage } from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import { mapMarketplaceError, MarketplaceDomainError } from '../common/marketplace.errors';
import { ListingPresenter } from '../listings/listing.presenter';
import { ListingRepository } from '../listings/listing.repository';
import { DiscoveryRepository, type DiscoveryCursor } from './discovery.repository';

const discoveryCursorSchema = z.strictObject({
  asOf: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.literal('DISCOVERY'),
  mode: z.enum(['NEW', 'TRENDING', 'RECOMMENDED']),
  score: z.number().int().nonnegative(),
});

@Injectable()
export class DiscoveryService {
  public constructor(
    @Inject(DiscoveryRepository) private readonly discovery: DiscoveryRepository,
    @Inject(ListingRepository) private readonly listings: ListingRepository,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
  ) {}

  public async feed(queryInput: unknown, viewerId?: string): Promise<ListingPage> {
    try {
      const query = feedQuerySchema.parse(queryInput);
      const cursor = this.parseCursor(query, query.cursor);
      const asOf = cursor?.asOf ?? new Date();
      const result = await this.discovery.rank(query.mode, viewerId, asOf, cursor, query.limit);
      const records = await this.listings.findByIds(result.ranks.map(({ id }) => id));
      const state = await this.listings.getViewerState(
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
