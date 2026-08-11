import { describe, expect, it } from 'vitest';

import {
  phoneVerificationStartInputSchema,
  phoneVerificationVerifyInputSchema,
} from './phone-verification-contracts';

describe('phone verification contracts', () => {
  it('keeps phone input as text for server-side international normalization', () => {
    expect(phoneVerificationStartInputSchema.parse({ phone: ' +92 300 1234567 ' })).toEqual({
      phone: '+92 300 1234567',
    });
  });

  it('preserves leading zeroes in verification codes', () => {
    expect(
      phoneVerificationVerifyInputSchema.parse({
        attemptId: '0b72b4ca-71f6-4c99-bac3-7a3efc455271',
        code: '012345',
      }).code,
    ).toBe('012345');
  });

  it.each([123456, '123', '12345678901', '12A456'])('rejects invalid OTP value %j', (code) => {
    expect(
      phoneVerificationVerifyInputSchema.safeParse({
        attemptId: '0b72b4ca-71f6-4c99-bac3-7a3efc455271',
        code,
      }).success,
    ).toBe(false);
  });

  it('rejects caller-authoritative verification fields', () => {
    expect(
      phoneVerificationStartInputSchema.safeParse({
        authProviderUserId: 'attacker-selected',
        phone: '+923001234567',
        userId: '0b72b4ca-71f6-4c99-bac3-7a3efc455271',
      }).success,
    ).toBe(false);
  });
});
