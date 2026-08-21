import { Injectable } from '@nestjs/common';
import { getPrismaClient, type PrismaClient, type ReviewDirection } from '@thriftage/db';
import { ratingSummarySchema, type RatingSummary } from '@thriftage/shared';

const displayCacheTtlMs = 30_000;
const maximumDisplayCacheEntries = 5_000;

interface CacheEntry<T> {
  readonly expiresAt: number;
  readonly value: T;
}

function setBoundedCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.delete(key);
  cache.set(key, { expiresAt: Date.now() + displayCacheTtlMs, value });
  while (cache.size > maximumDisplayCacheEntries) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

function currentValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (entry === undefined) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

@Injectable()
export class ReputationReader {
  // These values are display-only. Authorization and moderation reads never use this cache.
  private readonly summaryCache = new Map<string, CacheEntry<RatingSummary>>();
  private readonly summaryLoading = new Map<string, Promise<void>>();
  private readonly verifiedCache = new Map<string, CacheEntry<boolean>>();
  private readonly verifiedLoading = new Map<string, Promise<void>>();

  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async summaries(
    userIds: readonly string[],
    direction: ReviewDirection,
  ): Promise<ReadonlyMap<string, RatingSummary>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const result = new Map<string, RatingSummary>();
    const missing: string[] = [];
    for (const id of unique) {
      const cached = currentValue(this.summaryCache, this.summaryKey(direction, id));
      if (cached === undefined) missing.push(id);
      else result.set(id, cached);
    }
    await this.loadMissingSummaries(missing, direction);
    for (const id of missing) {
      const cached = currentValue(this.summaryCache, this.summaryKey(direction, id));
      if (cached !== undefined) result.set(id, cached);
    }
    return result;
  }

  public async verified(userIds: readonly string[]): Promise<ReadonlySet<string>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Set();
    const missing = unique.filter((id) => currentValue(this.verifiedCache, id) === undefined);
    await this.loadMissingVerification(missing);
    return new Set(unique.filter((id) => currentValue(this.verifiedCache, id) === true));
  }

  private async loadMissingSummaries(
    userIds: readonly string[],
    direction: ReviewDirection,
  ): Promise<void> {
    const pending = new Set<Promise<void>>();
    const unclaimed: string[] = [];
    for (const id of userIds) {
      const key = this.summaryKey(direction, id);
      const loading = this.summaryLoading.get(key);
      if (loading === undefined) unclaimed.push(id);
      else pending.add(loading);
    }
    if (unclaimed.length > 0) {
      const load = this.querySummaries(unclaimed, direction)
        .then((loaded) => {
          for (const id of unclaimed) {
            const value = loaded.get(id);
            if (value !== undefined) {
              setBoundedCache(this.summaryCache, this.summaryKey(direction, id), value);
            }
          }
        })
        .finally(() => {
          for (const id of unclaimed) {
            const key = this.summaryKey(direction, id);
            if (this.summaryLoading.get(key) === load) this.summaryLoading.delete(key);
          }
        });
      for (const id of unclaimed) this.summaryLoading.set(this.summaryKey(direction, id), load);
      pending.add(load);
    }
    await Promise.all(pending);
  }

  private async loadMissingVerification(userIds: readonly string[]): Promise<void> {
    const pending = new Set<Promise<void>>();
    const unclaimed: string[] = [];
    for (const id of userIds) {
      const loading = this.verifiedLoading.get(id);
      if (loading === undefined) unclaimed.push(id);
      else pending.add(loading);
    }
    if (unclaimed.length > 0) {
      const load = this.client.sellerVerification
        .findMany({
          select: { userId: true },
          where: { status: 'VERIFIED', userId: { in: unclaimed } },
        })
        .then((rows) => {
          const verified = new Set(rows.map(({ userId }) => userId));
          for (const id of unclaimed) setBoundedCache(this.verifiedCache, id, verified.has(id));
        })
        .finally(() => {
          for (const id of unclaimed) {
            if (this.verifiedLoading.get(id) === load) this.verifiedLoading.delete(id);
          }
        });
      for (const id of unclaimed) this.verifiedLoading.set(id, load);
      pending.add(load);
    }
    await Promise.all(pending);
  }

  private async querySummaries(
    userIds: readonly string[],
    direction: ReviewDirection,
  ): Promise<ReadonlyMap<string, RatingSummary>> {
    const rows = await this.client.review.groupBy({
      _count: true,
      by: ['revieweeId', 'rating'],
      where: {
        direction,
        moderationState: { not: 'INVALIDATED' },
        revieweeId: { in: [...userIds] },
      },
    });
    const result = new Map<string, RatingSummary>();
    for (const id of userIds) {
      const mine = rows.filter((row) => row.revieweeId === id);
      const count = mine.reduce((total, row) => total + row._count, 0);
      const distribution: { '1': number; '2': number; '3': number; '4': number; '5': number } = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      };
      for (const row of mine) {
        distribution[String(row.rating) as keyof typeof distribution] = row._count;
      }
      result.set(
        id,
        ratingSummarySchema.parse({
          average:
            count === 0
              ? null
              : mine.reduce((total, row) => total + row.rating * row._count, 0) / count,
          count,
          distribution,
        }),
      );
    }
    return result;
  }

  private summaryKey(direction: ReviewDirection, userId: string): string {
    return `${direction}:${userId}`;
  }
}
