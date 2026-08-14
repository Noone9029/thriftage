import { randomUUID } from 'node:crypto';

import type { GarmentRole, StylistIntent } from '@thriftage/shared';

import { OUTFIT_TEMPLATES, type OutfitTemplateName } from './ai-stylist.constants';
import type { ComposedOutfitCandidate, StylistInventoryCandidate } from './ai-stylist.types';

const neutralColors = new Set(['BLACK', 'WHITE', 'GREY', 'BROWN', 'BEIGE']);
const complementaryPairs = new Set([
  'BLUE:ORANGE',
  'GREEN:RED',
  'PURPLE:YELLOW',
  'BLACK:WHITE',
  'BEIGE:BROWN',
]);

export interface OutfitComposerOptions {
  readonly beamWidth?: number;
  readonly maxCandidatesPerRole?: number;
  readonly maxOptions: number;
}

interface Beam {
  readonly currency: string | null;
  readonly items: readonly StylistInventoryCandidate[];
  readonly score: number;
  readonly totalPriceMinor: number;
}

function colorCompatibility(left: string | null, right: string | null): number {
  if (left === null || right === null) return 0.5;
  if (left === right) return 1;
  if (neutralColors.has(left) || neutralColors.has(right)) return 0.9;
  const key = [left, right].sort().join(':');
  return complementaryPairs.has(key) ? 0.8 : 0.45;
}

function templateFor(
  intent: StylistIntent,
  candidates: readonly StylistInventoryCandidate[],
): OutfitTemplateName {
  const forcedIds = new Set(
    [intent.anchorListingId, ...intent.lockedListingIds].filter((id): id is string => id !== null),
  );
  const forcedRoles = candidates
    .filter(({ id }) => forcedIds.has(id))
    .map(({ garmentRole }) => garmentRole);
  if (forcedRoles.includes('DRESS') || intent.requestedGarmentRoles.includes('DRESS'))
    return 'DRESS';
  if (forcedRoles.includes('OUTERWEAR') || intent.requestedGarmentRoles.includes('OUTERWEAR'))
    return 'LAYERED';
  if (intent.occasion === 'GYM' || intent.requestedStyles.includes('athleisure'))
    return 'ATHLEISURE';
  return 'STANDARD';
}

function baseScore(candidate: StylistInventoryCandidate, intent: StylistIntent): number {
  let score = candidate.match?.score ?? 45;
  if (intent.requestedStyles.length > 0) {
    score += candidate.styleSlugs.some((slug) => intent.requestedStyles.includes(slug)) ? 20 : -20;
  }
  if (intent.colors.length > 0)
    score += intent.colors.includes(candidate.colorFamily as never) ? 12 : -4;
  if (intent.preferredFits.length > 0)
    score += intent.preferredFits.includes(candidate.fitType as never) ? 10 : -8;
  const occasionStyles: Partial<Record<NonNullable<StylistIntent['occasion']>, readonly string[]>> =
    {
      CASUAL_DAY: ['streetwear', 'minimalist', 'smart-casual'],
      DATE_NIGHT: ['smart-casual', 'formal', 'minimalist'],
      DINNER: ['smart-casual', 'formal', 'minimalist'],
      FORMAL_EVENT: ['formal', 'old-money', 'smart-casual'],
      GYM: ['athleisure'],
      PARTY: ['y2k', 'streetwear', 'gothic'],
      TRAVEL: ['athleisure', 'minimalist', 'streetwear'],
      UNIVERSITY: ['streetwear', 'minimalist', 'smart-casual', 'athleisure'],
      WEDDING: ['formal', 'old-money', 'smart-casual'],
      WORK: ['smart-casual', 'formal', 'minimalist', 'old-money'],
    };
  if (intent.occasion !== null) {
    const preferred = occasionStyles[intent.occasion] ?? [];
    score += candidate.styleSlugs.some((slug) => preferred.includes(slug)) ? 8 : 0;
  }
  if (candidate.sellerVerified) score += 3;
  score += Math.min(5, candidate.sellerCompletedSales / 4);
  return score;
}

function beamScore(items: readonly StylistInventoryCandidate[], base: number): number {
  if (items.length < 2) return base;
  const latest = items.at(-1);
  if (latest === undefined) return base;
  const harmony = items
    .slice(0, -1)
    .reduce((sum, item) => sum + colorCompatibility(item.colorFamily, latest.colorFamily), 0);
  const sharedStyle = latest.styleSlugs.some((slug) =>
    items.slice(0, -1).some((item) => item.styleSlugs.includes(slug)),
  );
  return base + harmony * 8 + (sharedStyle ? 8 : 0);
}

export function composeOutfitCandidates(
  allCandidates: readonly StylistInventoryCandidate[],
  intent: StylistIntent,
  options: OutfitComposerOptions,
): ComposedOutfitCandidate[] {
  const maxPerRole = options.maxCandidatesPerRole ?? 8;
  const beamWidth = options.beamWidth ?? 60;
  const anchorIds = new Set(
    [intent.anchorListingId, ...intent.lockedListingIds].filter((id): id is string => id !== null),
  );
  if ([...anchorIds].some((id) => !allCandidates.some((candidate) => candidate.id === id)))
    return [];
  const forcedCandidates = allCandidates.filter(({ id }) => anchorIds.has(id));
  if (
    forcedCandidates.some(
      ({ colorFamily, currency, sizeConfidence }) =>
        currency !== intent.currency ||
        sizeConfidence === 'MISMATCH' ||
        intent.excludedColors.includes(colorFamily as never),
    )
  )
    return [];
  const forcedRoleCounts = new Map<string, number>();
  for (const candidate of forcedCandidates)
    forcedRoleCounts.set(
      candidate.garmentRole,
      (forcedRoleCounts.get(candidate.garmentRole) ?? 0) + 1,
    );
  if ([...forcedRoleCounts.values()].some((count) => count > 1)) return [];
  const template = templateFor(intent, allCandidates);
  const roles = [...OUTFIT_TEMPLATES[template]] as GarmentRole[];
  for (const candidate of forcedCandidates) {
    if (!roles.includes(candidate.garmentRole as GarmentRole))
      roles.splice(0, 0, candidate.garmentRole as GarmentRole);
  }
  for (const role of intent.requestedGarmentRoles) {
    if (['ACCESSORY', 'BAG', 'JEWELRY'].includes(role) && !roles.includes(role)) roles.push(role);
  }

  const pools = new Map<GarmentRole, StylistInventoryCandidate[]>();
  for (const role of roles) {
    const forced = allCandidates.filter(
      (candidate) => candidate.garmentRole === role && anchorIds.has(candidate.id),
    );
    const eligible = allCandidates
      .filter(
        (candidate) =>
          candidate.garmentRole === role &&
          !intent.excludedColors.includes(candidate.colorFamily as never) &&
          (candidate.sizeConfidence === 'MATCH' || candidate.sizeConfidence === 'UNKNOWN'),
      )
      .sort(
        (left, right) =>
          baseScore(right, intent) - baseScore(left, intent) || left.id.localeCompare(right.id),
      );
    pools.set(role, (forced.length > 0 ? forced : eligible).slice(0, maxPerRole));
  }
  if (roles.some((role) => (pools.get(role)?.length ?? 0) === 0)) return [];

  let beams: Beam[] = [{ currency: null, items: [], score: 0, totalPriceMinor: 0 }];
  for (const role of roles) {
    const next: Beam[] = [];
    for (const beam of beams) {
      for (const candidate of pools.get(role) ?? []) {
        if (beam.items.some(({ id }) => id === candidate.id)) continue;
        if (beam.currency !== null && beam.currency !== candidate.currency) continue;
        const totalPriceMinor = beam.totalPriceMinor + candidate.priceMinor;
        if (intent.budgetMaxMinor !== null && totalPriceMinor > intent.budgetMaxMinor) continue;
        const items = [...beam.items, candidate];
        next.push({
          currency: candidate.currency,
          items,
          score: beamScore(items, beam.score + baseScore(candidate, intent)),
          totalPriceMinor,
        });
      }
    }
    next.sort(
      (left, right) => right.score - left.score || left.totalPriceMinor - right.totalPriceMinor,
    );
    beams = next.slice(0, beamWidth);
    if (beams.length === 0) return [];
  }

  return beams.slice(0, Math.min(options.maxOptions * 4, 12)).map((beam) => {
    const uncertainConstraints: string[] = [];
    if (beam.items.some(({ sizeConfidence }) => sizeConfidence === 'UNKNOWN'))
      uncertainConstraints.push(
        'Some listing sizes could not be matched to saved size preferences.',
      );
    if (intent.modesty === true)
      uncertainConstraints.push(
        'Coverage metadata is unavailable; review listing photos and details.',
      );
    return {
      currency: beam.currency as ComposedOutfitCandidate['currency'],
      id: randomUUID(),
      items: beam.items,
      matchScore: Math.max(0, Math.min(100, Math.round(beam.score / beam.items.length))),
      totalPriceMinor: beam.totalPriceMinor,
      uncertainConstraints,
    };
  });
}
