import type { ListingMatch } from '@thriftage/shared';

export interface RecommendationProfile {
  readonly budgetMaxMinor: number | null;
  readonly budgetMinMinor: number | null;
  readonly colors: ReadonlyMap<string, 'PREFER' | 'AVOID'>;
  readonly fits: ReadonlySet<string>;
  readonly profileVersion: number;
  readonly sizes: ReadonlySet<string>;
  readonly styles: ReadonlyMap<string, number>;
}

export interface RecommendationCandidate {
  readonly colorFamily: string | null;
  readonly createdAt: Date;
  readonly fitType: string | null;
  readonly garmentRole: string | null;
  readonly id: string;
  readonly likeCount: number;
  readonly priceMinor: number;
  readonly saveCount: number;
  readonly sellerCompletedSales: number;
  readonly sellerId: string;
  readonly sellerVerified: boolean;
  readonly sizeCompatibilityKey: string | null;
  readonly sizeSystem: string | null;
  readonly styleIds: readonly string[];
}

export interface RankingConfiguration {
  readonly behaviorWeight: number;
  readonly engagementWeight: number;
  readonly explorationWeight: number;
  readonly explorationPercent: number;
  readonly freshnessWeight: number;
  readonly maxPerSeller: number;
  readonly maxPerStyle: number;
  readonly personalWeight: number;
  readonly sellerWeight: number;
  readonly trustWeight: number;
  readonly version: string;
}

export interface BehaviorContext {
  readonly followedSellerIds: ReadonlySet<string>;
  readonly listingAffinity: ReadonlyMap<string, number>;
  readonly styleAffinity: ReadonlyMap<string, number>;
}

export interface RankedRecommendation {
  readonly id: string;
  readonly match: ListingMatch;
  readonly rankScore: number;
  readonly sellerId: string;
  readonly styleIds: readonly string[];
}

const componentWeights = {
  behavior: 10,
  budget: 15,
  color: 15,
  fit: 10,
  size: 15,
  style: 35,
} as const;
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const deterministicUnit = (value: string): number => {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4_294_967_295;
};

export function scoreMatch(
  candidate: RecommendationCandidate,
  profile: RecommendationProfile,
  behavior: BehaviorContext,
  algorithmVersion: string,
): ListingMatch {
  const contributions: {
    code: ListingMatch['contributions'][number]['code'];
    label: string;
    points: number;
  }[] = [];
  let earned = 0;
  let available = 0;
  const add = (
    code: ListingMatch['contributions'][number]['code'],
    label: string,
    weight: number,
    fraction: number,
  ) => {
    available += weight;
    const points = clamp(fraction, 0, 1) * weight;
    earned += points;
    if (points > 0) contributions.push({ code, label, points: Math.round(points * 10) / 10 });
  };

  if (candidate.styleIds.length > 0 && profile.styles.size > 0) {
    const strength = Math.max(0, ...candidate.styleIds.map((id) => profile.styles.get(id) ?? 0));
    add('STYLE', 'Matches your selected styles', componentWeights.style, strength / 5);
  }
  if (candidate.colorFamily !== null && profile.colors.size > 0) {
    const sentiment = profile.colors.get(candidate.colorFamily);
    add(
      'COLOR',
      'In a color you prefer',
      componentWeights.color,
      sentiment === 'PREFER' ? 1 : sentiment === 'AVOID' ? 0 : 0.35,
    );
  }
  if (candidate.fitType !== null && profile.fits.size > 0) {
    add(
      'FIT',
      'Fits the silhouette you prefer',
      componentWeights.fit,
      profile.fits.has(candidate.fitType) ? 1 : 0.25,
    );
  }
  if (
    candidate.sizeSystem !== null &&
    candidate.sizeCompatibilityKey !== null &&
    candidate.garmentRole !== null &&
    profile.sizes.size > 0
  ) {
    const key = `${candidate.garmentRole}:${candidate.sizeSystem}:${candidate.sizeCompatibilityKey.toUpperCase()}`;
    add(
      'SIZE',
      'Available in your saved size',
      componentWeights.size,
      profile.sizes.has(key) ? 1 : 0,
    );
  }
  if (profile.budgetMinMinor !== null || profile.budgetMaxMinor !== null) {
    const withinMin =
      profile.budgetMinMinor === null || candidate.priceMinor >= profile.budgetMinMinor;
    const withinMax =
      profile.budgetMaxMinor === null || candidate.priceMinor <= profile.budgetMaxMinor;
    add(
      'BUDGET',
      'Within your preferred budget',
      componentWeights.budget,
      withinMin && withinMax ? 1 : 0,
    );
  }
  if (behavior.styleAffinity.size > 0) {
    const affinity = Math.max(
      0,
      ...candidate.styleIds.map((id) => behavior.styleAffinity.get(id) ?? 0),
    );
    add(
      'BEHAVIOR',
      'Similar to items you engaged with',
      componentWeights.behavior,
      Math.min(1, affinity / 10),
    );
  }
  const score = available === 0 ? 0 : Math.round((earned / available) * 100);
  const sorted = contributions.sort((left, right) => right.points - left.points).slice(0, 3);
  return {
    algorithmVersion,
    contributions: sorted,
    profileVersion: profile.profileVersion,
    reasons: sorted.map(({ label }) => label),
    score,
  };
}

export function rankRecommendations(
  candidates: readonly RecommendationCandidate[],
  profile: RecommendationProfile,
  behavior: BehaviorContext,
  configuration: RankingConfiguration,
  asOf: Date,
): RankedRecommendation[] {
  const ranked = candidates.map((candidate) => {
    const match = scoreMatch(candidate, profile, behavior, configuration.version);
    const ageHours = Math.max(0, (asOf.getTime() - candidate.createdAt.getTime()) / 3_600_000);
    const freshness = clamp(100 - ageHours / 7.2);
    const engagement = clamp(Math.log1p(candidate.likeCount * 2 + candidate.saveCount * 3) * 18);
    const trust = clamp(
      (candidate.sellerVerified ? 65 : 25) + Math.min(35, candidate.sellerCompletedSales * 3),
    );
    const seller = behavior.followedSellerIds.has(candidate.sellerId) ? 100 : 0;
    const behaviorScore = clamp(
      Math.max(0, ...candidate.styleIds.map((id) => behavior.styleAffinity.get(id) ?? 0)) * 10,
    );
    const exploration =
      deterministicUnit(`${candidate.id}:${configuration.version}`) <
      configuration.explorationPercent / 100
        ? 100
        : 0;
    const rankScore =
      (match.score * configuration.personalWeight +
        behaviorScore * configuration.behaviorWeight +
        seller * configuration.sellerWeight +
        freshness * configuration.freshnessWeight +
        trust * configuration.trustWeight +
        engagement * configuration.engagementWeight +
        exploration * configuration.explorationWeight) /
      100;
    return {
      id: candidate.id,
      match,
      rankScore,
      sellerId: candidate.sellerId,
      styleIds: candidate.styleIds,
    };
  });
  ranked.sort((left, right) => right.rankScore - left.rankScore || left.id.localeCompare(right.id));

  const sellerCounts = new Map<string, number>();
  const styleCounts = new Map<string, number>();
  const selected: RankedRecommendation[] = [];
  const deferred: RankedRecommendation[] = [];
  for (const item of ranked) {
    const primaryStyle = item.styleIds[0];
    const sellerAtCap = (sellerCounts.get(item.sellerId) ?? 0) >= configuration.maxPerSeller;
    const styleAtCap =
      primaryStyle !== undefined &&
      (styleCounts.get(primaryStyle) ?? 0) >= configuration.maxPerStyle;
    if (sellerAtCap || styleAtCap) {
      deferred.push(item);
      continue;
    }
    selected.push(item);
    sellerCounts.set(item.sellerId, (sellerCounts.get(item.sellerId) ?? 0) + 1);
    if (primaryStyle !== undefined)
      styleCounts.set(primaryStyle, (styleCounts.get(primaryStyle) ?? 0) + 1);
  }
  return [...selected, ...deferred];
}
