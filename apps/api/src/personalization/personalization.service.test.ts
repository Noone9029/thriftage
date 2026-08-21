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
    const prisma = {
      follow: { findMany: findFollows },
      listing: { findMany: findCandidates },
      listingLike: { findMany: findLikes },
      message: { findMany: findMessages },
      order: { findMany: findOrders },
      recommendationConfiguration: { findFirst: vi.fn().mockResolvedValue(null) },
      recommendationEvent: { findMany: findEvents },
      savedListing: { findMany: findSaves },
      userBlock: { findMany: vi.fn().mockResolvedValue([]) },
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
      expect.objectContaining({ relationLoadStrategy: 'join' }),
    );
    expect(findFollows).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { followedId: 'desc' }],
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
});
