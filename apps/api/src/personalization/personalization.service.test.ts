import type { PrismaClient } from '@thriftage/db';
import { describe, expect, it, vi } from 'vitest';

import { PersonalizationService } from './personalization.service';

describe('PersonalizationService recommendation history', () => {
  it('bounds every behavioral signal query and reads newest records first', async () => {
    const findFollows = vi.fn().mockResolvedValue([]);
    const queryBehavioralSignals = vi.fn().mockResolvedValue([]);
    const findCandidates = vi.fn().mockResolvedValue([]);
    const findProfile = vi.fn().mockResolvedValue(null);
    const findConfiguration = vi.fn().mockResolvedValue(null);
    const prisma = {
      $queryRaw: queryBehavioralSignals,
      follow: { findMany: findFollows },
      listing: { findMany: findCandidates },
      recommendationConfiguration: { findFirst: findConfiguration },
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
    expect(queryBehavioralSignals).toHaveBeenCalledTimes(1);
    const query = queryBehavioralSignals.mock.calls[0]?.[0] as
      { readonly strings?: readonly string[] } | undefined;
    const sql = query?.strings?.join('') ?? '';
    expect(sql.match(/LIMIT/g)).toHaveLength(5);
    expect(sql).toContain('UNION ALL');
  });

  it('reuses active configuration within one service instance', async () => {
    const findConfiguration = vi.fn().mockResolvedValue(null);
    const empty = vi.fn().mockResolvedValue([]);
    const prisma = {
      $queryRaw: empty,
      follow: { findMany: empty },
      listing: { findMany: empty },
      recommendationConfiguration: { findFirst: findConfiguration },
      userStyleProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    const service = new PersonalizationService(prisma);
    const asOf = new Date('2026-08-21T00:00:00.000Z');

    await service.rankForYou('00000000-0000-4000-8000-000000000001', asOf);
    await service.rankForYou('00000000-0000-4000-8000-000000000001', asOf);

    expect(findConfiguration).toHaveBeenCalledTimes(1);
  });
});
