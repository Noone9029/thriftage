import type { PrismaClient } from '@thriftage/db';
import { describe, expect, it, vi } from 'vitest';

import { PersonalizationService } from './personalization.service';

describe('PersonalizationService recommendation history', () => {
  it('bounds every behavioral signal query and reads newest records first', async () => {
    const findFollows = vi.fn().mockResolvedValue([]);
    const findEvents = vi.fn().mockResolvedValue([]);
    const findLikes = vi.fn().mockResolvedValue([]);
    const findSaves = vi.fn().mockResolvedValue([]);
    const findOrders = vi.fn().mockResolvedValue([]);
    const findMessages = vi.fn().mockResolvedValue([]);
    const findCandidates = vi.fn().mockResolvedValue([]);
    const findProfile = vi.fn().mockResolvedValue(null);
    const findConfiguration = vi.fn().mockResolvedValue(null);
    const prisma = {
      follow: { findMany: findFollows },
      listing: { findMany: findCandidates },
      listingLike: { findMany: findLikes },
      message: { findMany: findMessages },
      order: { findMany: findOrders },
      recommendationConfiguration: { findFirst: findConfiguration },
      recommendationEvent: { findMany: findEvents },
      savedListing: { findMany: findSaves },
      userStyleProfile: { findUnique: findProfile },
    } as unknown as PrismaClient;

    const result = await new PersonalizationService(prisma).rankForYou(
      '00000000-0000-4000-8000-000000000001',
      new Date('2026-08-21T00:00:00.000Z'),
    );

    expect(result.ranked).toEqual([]);
    expect(findProfile).toHaveBeenCalledWith(
      expect.objectContaining({ relationLoadStrategy: 'join' }),
    );
    expect(findCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
        where: expect.objectContaining({
          seller: expect.objectContaining({
            blocksCreated: { none: { blockedUserId: '00000000-0000-4000-8000-000000000001' } },
            blocksReceived: { none: { blockerId: '00000000-0000-4000-8000-000000000001' } },
          }),
        }),
      }),
    );
    expect(findFollows).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { followedId: 'desc' }],
        select: { createdAt: true, followedId: true },
        take: 500,
      }),
    );
    expect(findEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        relationLoadStrategy: 'join',
        take: 500,
      }),
    );
    for (const query of [findLikes, findSaves]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { listingId: 'desc' }],
          relationLoadStrategy: 'join',
          take: 500,
        }),
      );
    }
    for (const query of [findOrders, findMessages]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          relationLoadStrategy: 'join',
          take: 500,
        }),
      );
    }
  });

  it('reuses active configuration within one service instance', async () => {
    const findConfiguration = vi.fn().mockResolvedValue(null);
    const empty = vi.fn().mockResolvedValue([]);
    const prisma = {
      follow: { findMany: empty },
      listing: { findMany: empty },
      listingLike: { findMany: empty },
      message: { findMany: empty },
      order: { findMany: empty },
      recommendationConfiguration: { findFirst: findConfiguration },
      recommendationEvent: { findMany: empty },
      savedListing: { findMany: empty },
      userStyleProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    const service = new PersonalizationService(prisma);
    const asOf = new Date('2026-08-21T00:00:00.000Z');

    await service.rankForYou('00000000-0000-4000-8000-000000000001', asOf);
    await service.rankForYou('00000000-0000-4000-8000-000000000001', asOf);

    expect(findConfiguration).toHaveBeenCalledTimes(1);
  });
});
