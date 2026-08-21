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
});
