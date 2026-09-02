import { describe, expect, it } from 'vitest';

import { calculateOrderFinancialSnapshot, roundBasisPointsHalfUp } from './financial-policy';

describe('financial policy', () => {
  it('charges exactly ten percent of item subtotal and excludes shipping from seller net', () => {
    expect(
      calculateOrderFinancialSnapshot({ itemSubtotalMinor: 150_000, shippingMinor: 25_000 }),
    ).toEqual({
      commissionBps: 1_000,
      commissionMinor: 15_000,
      financialPolicyVersion: 'marketplace-fees-v1',
      itemSubtotalMinor: 150_000,
      quantity: 1,
      sellerNetMinor: 135_000,
      totalMinor: 175_000,
      withholdingBps: 0,
      withholdingMinor: 0,
      withholdingRuleVersion: 'withholding-unapproved-v1',
    });
  });

  it('rounds basis points half-up in minor units', () => {
    expect(roundBasisPointsHalfUp(15, 1_000)).toBe(2);
    expect(roundBasisPointsHalfUp(14, 1_000)).toBe(1);
  });

  it('keeps approved withholding separately versioned', () => {
    expect(
      calculateOrderFinancialSnapshot({
        itemSubtotalMinor: 10_000,
        shippingMinor: 500,
        withholdingBps: 250,
        withholdingRuleVersion: 'counsel-approved-v2',
      }),
    ).toMatchObject({
      sellerNetMinor: 8_750,
      withholdingMinor: 250,
      withholdingRuleVersion: 'counsel-approved-v2',
    });
  });
});
