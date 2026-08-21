import type { PrismaClient } from '@thriftage/db';
import { describe, expect, it, vi } from 'vitest';

import { ReputationReader } from './reputation.reader';

describe('ReputationReader display cache', () => {
  it('caches rating summaries, including the empty result', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { _count: 2, rating: 5, revieweeId: 'seller-a' },
      { _count: 1, rating: 3, revieweeId: 'seller-a' },
    ]);
    const prisma = {
      review: { groupBy },
      sellerVerification: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const reader = new ReputationReader(prisma);

    const first = await reader.summaries(['seller-a', 'seller-b'], 'BUYER_TO_SELLER');
    const second = await reader.summaries(['seller-b', 'seller-a'], 'BUYER_TO_SELLER');

    expect(first.get('seller-a')).toMatchObject({ average: 13 / 3, count: 3 });
    expect(first.get('seller-b')).toMatchObject({ average: null, count: 0 });
    expect(second).toEqual(first);
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent summary loads for the same seller', async () => {
    let resolveRows: ((rows: unknown[]) => void) | undefined;
    const groupBy = vi.fn(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveRows = resolve;
        }),
    );
    const prisma = {
      review: { groupBy },
      sellerVerification: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const reader = new ReputationReader(prisma);

    const first = reader.summaries(['seller-a'], 'BUYER_TO_SELLER');
    const second = reader.summaries(['seller-a'], 'BUYER_TO_SELLER');
    expect(groupBy).toHaveBeenCalledTimes(1);
    resolveRows?.([{ _count: 1, rating: 4, revieweeId: 'seller-a' }]);

    await expect(first).resolves.toEqual(await second);
  });

  it('caches both verified and unverified display states', async () => {
    const findMany = vi.fn().mockResolvedValue([{ userId: 'seller-a' }]);
    const prisma = {
      review: { groupBy: vi.fn().mockResolvedValue([]) },
      sellerVerification: { findMany },
    } as unknown as PrismaClient;
    const reader = new ReputationReader(prisma);

    const first = await reader.verified(['seller-a', 'seller-b']);
    const second = await reader.verified(['seller-b', 'seller-a']);

    expect([...first]).toEqual(['seller-a']);
    expect(second).toEqual(first);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
