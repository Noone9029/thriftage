import { describe, expect, it } from 'vitest';

import {
  rankRecommendations,
  scoreMatch,
  type RecommendationCandidate,
  type RecommendationProfile,
} from './recommendation-engine';

const profile: RecommendationProfile = {
  budgetMaxMinor: 500_000,
  budgetMinMinor: 100_000,
  colors: new Map([['BLACK', 'PREFER']]),
  fits: new Set(['RELAXED']),
  profileVersion: 3,
  sizes: new Set(['TOP:ALPHA:M']),
  styles: new Map([['streetwear', 5]]),
};
const candidate: RecommendationCandidate = {
  colorFamily: 'BLACK',
  createdAt: new Date('2026-08-13T00:00:00Z'),
  fitType: 'RELAXED',
  garmentRole: 'TOP',
  id: 'a',
  likeCount: 5,
  priceMinor: 300_000,
  saveCount: 2,
  sellerCompletedSales: 4,
  sellerId: 'seller-a',
  sellerVerified: true,
  sizeCompatibilityKey: 'M',
  sizeSystem: 'ALPHA',
  styleIds: ['streetwear'],
};
const behavior = {
  followedSellerIds: new Set<string>(),
  listingAffinity: new Map<string, number>(),
  styleAffinity: new Map([['streetwear', 8]]),
};

describe('recommendation engine', () => {
  it('produces a real bounded score and only supported reasons', () => {
    const match = scoreMatch(candidate, profile, behavior, 'rules-v1');
    expect(match.score).toBe(98);
    expect(match.reasons).toHaveLength(3);
    expect(match.algorithmVersion).toBe('rules-v1');
  });

  it('is deterministic and applies diversity before deferred results', () => {
    const config = {
      behaviorWeight: 15,
      engagementWeight: 7,
      explorationWeight: 5,
      explorationPercent: 10,
      freshnessWeight: 12,
      maxPerSeller: 1,
      maxPerStyle: 4,
      personalWeight: 45,
      sellerWeight: 8,
      trustWeight: 8,
      version: 'rules-v1',
    };
    const candidates = [
      candidate,
      { ...candidate, id: 'b' },
      { ...candidate, id: 'c', sellerId: 'seller-b' },
    ];
    const first = rankRecommendations(
      candidates,
      profile,
      behavior,
      config,
      new Date('2026-08-13T01:00:00Z'),
    );
    const second = rankRecommendations(
      candidates,
      profile,
      behavior,
      config,
      new Date('2026-08-13T01:00:00Z'),
    );
    expect(first).toEqual(second);
    expect(first.slice(0, 2).map(({ sellerId }) => sellerId)).toEqual(['seller-a', 'seller-b']);
  });
});
