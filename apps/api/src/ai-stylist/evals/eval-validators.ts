import type { StylistIntent } from '@thriftage/shared';

import type { ComposedOutfitCandidate } from '../ai-stylist.types';

export interface EvalConstraintContext {
  readonly blockedSellerIds: ReadonlySet<string>;
  readonly eligibleListingIds: ReadonlySet<string>;
  readonly inventoryListingIds: ReadonlySet<string>;
  readonly intent: StylistIntent;
}

export interface EvalValidationResult {
  readonly checks: {
    readonly blockedSellersExcluded: boolean;
    readonly budgetSatisfied: boolean;
    readonly colorsSatisfied: boolean;
    readonly currencySatisfied: boolean;
    readonly inventoryGrounded: boolean;
    readonly listingStateEligible: boolean;
    readonly lockedItemsPreserved: boolean;
    readonly outfitComplete: boolean;
    readonly sizesValid: boolean;
  };
  readonly passed: boolean;
}

export function validateEvalOutfit(
  outfit: ComposedOutfitCandidate,
  context: EvalConstraintContext,
): EvalValidationResult {
  const ids = new Set(outfit.items.map(({ id }) => id));
  const roles = new Set(outfit.items.map(({ garmentRole }) => garmentRole));
  const expectedRoles = roles.has('DRESS')
    ? ['DRESS', 'SHOES']
    : roles.has('OUTERWEAR')
      ? ['TOP', 'BOTTOM', 'OUTERWEAR', 'SHOES']
      : ['TOP', 'BOTTOM', 'SHOES'];
  const checks = {
    blockedSellersExcluded: outfit.items.every(
      ({ sellerId }) => !context.blockedSellerIds.has(sellerId),
    ),
    budgetSatisfied:
      context.intent.budgetMaxMinor === null ||
      outfit.totalPriceMinor <= context.intent.budgetMaxMinor,
    colorsSatisfied: outfit.items.every(
      ({ colorFamily }) =>
        colorFamily === null || !context.intent.excludedColors.includes(colorFamily as never),
    ),
    currencySatisfied:
      outfit.currency === context.intent.currency &&
      outfit.items.every(({ currency }) => currency === outfit.currency),
    inventoryGrounded: outfit.items.every(({ id }) => context.inventoryListingIds.has(id)),
    listingStateEligible: outfit.items.every(({ id }) => context.eligibleListingIds.has(id)),
    lockedItemsPreserved: [context.intent.anchorListingId, ...context.intent.lockedListingIds]
      .filter((id): id is string => id !== null)
      .every((id) => ids.has(id)),
    outfitComplete: expectedRoles.every((role) => roles.has(role)),
    sizesValid: outfit.items.every(({ sizeConfidence }) => sizeConfidence !== 'MISMATCH'),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}
