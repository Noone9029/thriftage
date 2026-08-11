import { describe, expect, it } from 'vitest';

import { maskPhoneNumber, normalizePhoneNumber } from './phone-number';

describe('phone number handling', () => {
  it.each([
    ['+92 300 1234567', '+923001234567'],
    ['+1 (415) 555-2671', '+14155552671'],
    ['+44 20 7183 8750', '+442071838750'],
  ])('normalizes %s to canonical E.164', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each(['03001234567', '+999123', 'not-a-phone', ''])('rejects invalid phone %j', (input) => {
    try {
      normalizePhoneNumber(input);
      expect.fail('Expected phone normalization to fail.');
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: 'PHONE_INVALID' });
    }
  });

  it('masks private phone PII while retaining minimal recognition context', () => {
    expect(maskPhoneNumber('+923001234567')).toBe('+92******4567');
    expect(maskPhoneNumber('+14155552671')).toBe('+1******2671');
  });
});
