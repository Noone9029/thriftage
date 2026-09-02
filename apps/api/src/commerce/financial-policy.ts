export const COMMISSION_BPS = 1_000 as const;
export const FINANCIAL_POLICY_VERSION = 'marketplace-fees-v1' as const;
export const WITHHOLDING_UNAPPROVED_VERSION = 'withholding-unapproved-v1' as const;

export interface OrderFinancialSnapshot {
  readonly commissionBps: typeof COMMISSION_BPS;
  readonly commissionMinor: number;
  readonly financialPolicyVersion: typeof FINANCIAL_POLICY_VERSION;
  readonly itemSubtotalMinor: number;
  readonly quantity: 1;
  readonly sellerNetMinor: number;
  readonly totalMinor: number;
  readonly withholdingBps: number;
  readonly withholdingMinor: number;
  readonly withholdingRuleVersion: string;
}

export function roundBasisPointsHalfUp(amountMinor: number, basisPoints: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('INVALID_AMOUNT');
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error('INVALID_BASIS_POINTS');
  }
  return Math.floor((amountMinor * basisPoints + 5_000) / 10_000);
}

export function calculateOrderFinancialSnapshot(input: {
  readonly itemSubtotalMinor: number;
  readonly shippingMinor: number;
  readonly withholdingBps?: number;
  readonly withholdingRuleVersion?: string;
}): OrderFinancialSnapshot {
  const withholdingBps = input.withholdingBps ?? 0;
  const commissionMinor = roundBasisPointsHalfUp(input.itemSubtotalMinor, COMMISSION_BPS);
  const withholdingMinor = roundBasisPointsHalfUp(input.itemSubtotalMinor, withholdingBps);
  const sellerNetMinor = input.itemSubtotalMinor - commissionMinor - withholdingMinor;
  if (!Number.isSafeInteger(input.shippingMinor) || input.shippingMinor < 0 || sellerNetMinor < 0) {
    throw new Error('INVALID_FINANCIAL_SNAPSHOT');
  }
  return {
    commissionBps: COMMISSION_BPS,
    commissionMinor,
    financialPolicyVersion: FINANCIAL_POLICY_VERSION,
    itemSubtotalMinor: input.itemSubtotalMinor,
    quantity: 1,
    sellerNetMinor,
    totalMinor: input.itemSubtotalMinor + input.shippingMinor,
    withholdingBps,
    withholdingMinor,
    withholdingRuleVersion: input.withholdingRuleVersion ?? WITHHOLDING_UNAPPROVED_VERSION,
  };
}
