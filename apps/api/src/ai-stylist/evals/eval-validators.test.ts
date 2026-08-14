import { describe, expect, it } from 'vitest';

import { composeOutfitCandidates } from '../outfit-composer';
import { STYLIST_EVAL_DATASET } from './eval-dataset';
import { validateEvalOutfit } from './eval-validators';

describe('AI Stylist deterministic evaluation gates', () => {
  it.each(STYLIST_EVAL_DATASET)(
    '$name satisfies the expected hard-invariant outcome',
    (testCase) => {
      const blocked = new Set(testCase.blockedSellerIds);
      const eligible = new Set(testCase.eligibleListingIds);
      const filtered = testCase.candidates.filter(
        ({ id, sellerId }) => eligible.has(id) && !blocked.has(sellerId),
      );
      const outfits = composeOutfitCandidates(filtered, testCase.intent, { maxOptions: 3 });
      expect(outfits.length > 0).toBe(testCase.expectsCompleteOutfit);
      for (const outfit of outfits) {
        expect(
          validateEvalOutfit(outfit, {
            blockedSellerIds: blocked,
            eligibleListingIds: eligible,
            intent: testCase.intent,
            inventoryListingIds: new Set(testCase.candidates.map(({ id }) => id)),
          }),
        ).toMatchObject({ passed: true });
      }
    },
  );

  it('detects fabricated, sold, blocked, over-budget, size-mismatched, and unlocked output', () => {
    const testCase = STYLIST_EVAL_DATASET[0]!;
    const valid = composeOutfitCandidates(testCase.candidates, testCase.intent, {
      maxOptions: 1,
    })[0]!;
    const invalid = {
      ...valid,
      items: [
        ...valid.items.slice(0, -1),
        {
          ...valid.items.at(-1)!,
          id: '90000000-0000-4000-8000-000000000001',
          priceMinor: 9_000_000,
          sellerId: '90000000-0000-4000-8000-000000000002',
          sizeConfidence: 'MISMATCH' as const,
        },
      ],
      totalPriceMinor: 9_500_000,
    };
    const result = validateEvalOutfit(invalid, {
      blockedSellerIds: new Set(['90000000-0000-4000-8000-000000000002']),
      eligibleListingIds: new Set(testCase.eligibleListingIds),
      intent: { ...testCase.intent, lockedListingIds: ['90000000-0000-4000-8000-000000000003'] },
      inventoryListingIds: new Set(testCase.candidates.map(({ id }) => id)),
    });
    expect(result.passed).toBe(false);
    expect(result.checks).toMatchObject({
      blockedSellersExcluded: false,
      budgetSatisfied: false,
      inventoryGrounded: false,
      listingStateEligible: false,
      lockedItemsPreserved: false,
      sizesValid: false,
    });
  });
});
