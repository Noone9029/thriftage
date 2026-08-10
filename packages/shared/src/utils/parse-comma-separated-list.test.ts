import { describe, expect, it } from 'vitest';

import { parseCommaSeparatedList } from './parse-comma-separated-list';

describe('parseCommaSeparatedList', () => {
  it('trims entries, removes blanks, and preserves unique order', () => {
    expect(parseCommaSeparatedList(' alpha, beta,alpha, , gamma ')).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('returns an empty list for missing configuration', () => {
    expect(parseCommaSeparatedList(undefined)).toEqual([]);
  });
});
