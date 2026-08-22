import type { PrismaClient } from '@thriftage/db';
import { describe, expect, it, vi } from 'vitest';

import { ListingRepository } from './listing.repository';

describe('ListingRepository read hydration', () => {
  it('loads nested listing relations with one database join query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { listing: { findMany } } as unknown as PrismaClient;
    const repository = new ListingRepository(prisma);

    await expect(repository.findByIds(['00000000-0000-4000-8000-000000000001'])).resolves.toEqual(
      [],
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ relationLoadStrategy: 'join' }),
    );
  });

  it('applies bidirectional block exclusion inside authenticated search', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { listing: { findMany } } as unknown as PrismaClient;
    const repository = new ListingRepository(prisma);
    const viewerId = '00000000-0000-4000-8000-000000000001';

    await repository.search({ limit: 20, sort: 'NEWEST' }, null, viewerId);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seller: expect.objectContaining({
            blocksCreated: { none: { blockedUserId: viewerId } },
            blocksReceived: { none: { blockerId: viewerId } },
          }),
        }),
      }),
    );
  });

  it('hydrates chronological feed rows in one query with authoritative block filtering', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { listing: { findMany } } as unknown as PrismaClient;
    const repository = new ListingRepository(prisma);
    const viewerId = '00000000-0000-4000-8000-000000000001';

    await repository.listNewFeed(viewerId, new Date('2026-08-22T00:00:00Z'), null, 20);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
        take: 21,
        where: expect.objectContaining({
          seller: expect.objectContaining({
            blocksCreated: { none: { blockedUserId: viewerId } },
            blocksReceived: { none: { blockerId: viewerId } },
          }),
          status: 'ACTIVE',
        }),
      }),
    );
  });
});
