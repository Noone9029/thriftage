import type { StylistIntent } from '@thriftage/shared';
import { describe, expect, it } from 'vitest';

import type { StylistInventoryCandidate } from './ai-stylist.types';
import { composeOutfitCandidates } from './outfit-composer';

const ids = {
  accessory: '00000000-0000-4000-8000-000000000009',
  bottom: '00000000-0000-4000-8000-000000000002',
  dress: '00000000-0000-4000-8000-000000000005',
  jacket: '00000000-0000-4000-8000-000000000004',
  shoes: '00000000-0000-4000-8000-000000000003',
  shoes2: '00000000-0000-4000-8000-000000000006',
  top: '00000000-0000-4000-8000-000000000001',
};

function candidate(
  id: string,
  garmentRole: string,
  priceMinor: number,
  overrides: Partial<StylistInventoryCandidate> = {},
): StylistInventoryCandidate {
  return {
    colorFamily: 'BLACK',
    currency: 'PKR',
    fitType: 'REGULAR',
    garmentRole,
    id,
    match: null,
    priceMinor,
    sellerCompletedSales: 4,
    sellerId: `10000000-0000-4000-8000-${id.slice(-12)}`,
    sellerVerified: true,
    sizeCompatibilityKey: 'M',
    sizeConfidence: 'MATCH',
    sizeSystem: 'LETTER',
    styleSlugs: ['minimalist'],
    ...overrides,
  };
}

function intent(overrides: Partial<StylistIntent> = {}): StylistIntent {
  return {
    anchorListingId: null,
    budgetMaxMinor: null,
    budgetMinMinor: null,
    colors: [],
    currency: 'PKR',
    excludedColors: [],
    freeTextObjective: 'Build an outfit',
    lockedListingIds: [],
    modesty: null,
    occasion: null,
    optionCount: 3,
    preferredFits: [],
    refinement: 'NONE',
    requestedGarmentRoles: [],
    requestedStyles: [],
    sizeConstraints: [],
    ...overrides,
  };
}

const standard = [
  candidate(ids.top, 'TOP', 200_000),
  candidate(ids.bottom, 'BOTTOM', 250_000),
  candidate(ids.shoes, 'SHOES', 300_000),
];

describe('composeOutfitCandidates', () => {
  it('creates a complete top, bottom, and shoes outfit', () => {
    const result = composeOutfitCandidates(standard, intent(), { maxOptions: 3 });
    expect(result[0]?.items.map(({ garmentRole }) => garmentRole)).toEqual([
      'TOP',
      'BOTTOM',
      'SHOES',
    ]);
  });

  it('creates a dress and shoes outfit', () => {
    const result = composeOutfitCandidates(
      [candidate(ids.dress, 'DRESS', 400_000), candidate(ids.shoes, 'SHOES', 300_000)],
      intent({ requestedGarmentRoles: ['DRESS'] }),
      { maxOptions: 1 },
    );
    expect(result[0]?.items.map(({ garmentRole }) => garmentRole)).toEqual(['DRESS', 'SHOES']);
  });

  it('rejects incomplete required roles', () => {
    expect(composeOutfitCandidates(standard.slice(0, 2), intent(), { maxOptions: 1 })).toEqual([]);
  });

  it('accepts a budget exactly met and rejects an exceeded budget', () => {
    expect(
      composeOutfitCandidates(standard, intent({ budgetMaxMinor: 750_000 }), { maxOptions: 1 })[0]
        ?.totalPriceMinor,
    ).toBe(750_000);
    expect(
      composeOutfitCandidates(standard, intent({ budgetMaxMinor: 749_999 }), { maxOptions: 1 }),
    ).toEqual([]);
  });

  it('never combines currencies without conversion', () => {
    const mixed = standard.map((item) =>
      item.id === ids.shoes ? { ...item, currency: 'USD' as const } : item,
    );
    expect(composeOutfitCandidates(mixed, intent(), { maxOptions: 1 })).toEqual([]);
  });

  it('excludes explicit size mismatches', () => {
    const mismatch = standard.map((item) =>
      item.id === ids.bottom ? { ...item, sizeConfidence: 'MISMATCH' as const } : item,
    );
    expect(composeOutfitCandidates(mismatch, intent(), { maxOptions: 1 })).toEqual([]);
  });

  it('retains an eligible anchor and rejects a missing or incompatible anchor', () => {
    const anchored = composeOutfitCandidates(standard, intent({ anchorListingId: ids.top }), {
      maxOptions: 1,
    });
    expect(anchored[0]?.items.map(({ id }) => id)).toContain(ids.top);
    expect(
      composeOutfitCandidates(standard, intent({ anchorListingId: ids.jacket }), { maxOptions: 1 }),
    ).toEqual([]);
    expect(
      composeOutfitCandidates(
        standard.map((item) =>
          item.id === ids.top ? { ...item, sizeConfidence: 'MISMATCH' as const } : item,
        ),
        intent({ anchorListingId: ids.top }),
        { maxOptions: 1 },
      ),
    ).toEqual([]);
  });

  it('retains a locked outerwear item across refinement', () => {
    const result = composeOutfitCandidates(
      [...standard, candidate(ids.jacket, 'OUTERWEAR', 300_000)],
      intent({ lockedListingIds: [ids.jacket] }),
      { maxOptions: 1 },
    );
    expect(result[0]?.items.map(({ id }) => id)).toContain(ids.jacket);
  });

  it('rejects contradictory locked items in the same garment role', () => {
    const result = composeOutfitCandidates(
      [...standard, candidate(ids.shoes2, 'SHOES', 250_000)],
      intent({ lockedListingIds: [ids.shoes, ids.shoes2] }),
      { maxOptions: 1 },
    );
    expect(result).toEqual([]);
  });

  it('adds an optional accessory only when requested', () => {
    const withAccessory = [...standard, candidate(ids.accessory, 'ACCESSORY', 50_000)];
    expect(
      composeOutfitCandidates(withAccessory, intent(), { maxOptions: 1 })[0]?.items,
    ).toHaveLength(3);
    expect(
      composeOutfitCandidates(withAccessory, intent({ requestedGarmentRoles: ['ACCESSORY'] }), {
        maxOptions: 1,
      })[0]?.items,
    ).toHaveLength(4);
  });

  it('reports uncertainty for unknown sizes and explicit modesty requests', () => {
    const result = composeOutfitCandidates(
      standard.map((item) => ({ ...item, sizeConfidence: 'UNKNOWN' as const })),
      intent({ modesty: true }),
      { maxOptions: 1 },
    );
    expect(result[0]?.uncertainConstraints).toHaveLength(2);
  });
});
