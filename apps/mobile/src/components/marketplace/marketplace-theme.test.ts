import { describe, expect, it } from 'vitest';

import { formatMoney } from './marketplace-theme';

describe('marketplace money formatting', () => {
  it('formats whole minor-unit amounts without unnecessary decimals', () => {
    expect(formatMoney(150_000, 'PKR')).toBe('PKR 1,500');
  });

  it('preserves meaningful minor-unit precision', () => {
    expect(formatMoney(150_050, 'PKR')).toBe('PKR 1,500.50');
  });
});
