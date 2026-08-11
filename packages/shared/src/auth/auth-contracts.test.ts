import { describe, expect, it } from 'vitest';

import {
  mobileForgotPasswordInputSchema,
  mobilePhoneLoginVerifyInputSchema,
  mobileResetPasswordInputSchema,
  mobileSignupInputSchema,
} from './auth-contracts';

describe('mobile authentication contracts', () => {
  it('normalizes signup identity fields without persisting confirmation data', () => {
    expect(
      mobileSignupInputSchema.parse({
        confirmPassword: 'Secure123',
        email: ' USER@Example.com ',
        fullName: '  Ayesha Khan  ',
        password: 'Secure123',
        phone: '0300 1234567',
      }),
    ).toMatchObject({
      email: 'user@example.com',
      fullName: 'Ayesha Khan',
      phone: '+923001234567',
    });
  });

  it('rejects invalid email, weak passwords, and mismatched confirmation', () => {
    expect(() =>
      mobileSignupInputSchema.parse({
        confirmPassword: 'different',
        email: 'invalid',
        fullName: 'User',
        password: 'weak',
        phone: 'invalid',
      }),
    ).toThrow();
  });

  it('validates forgot-password and reset-password inputs', () => {
    expect(mobileForgotPasswordInputSchema.parse({ email: ' USER@example.com ' })).toEqual({
      email: 'user@example.com',
    });
    expect(() =>
      mobileResetPasswordInputSchema.parse({
        confirmPassword: 'Secure124',
        password: 'Secure123',
      }),
    ).toThrow();
  });

  it('normalizes global phone input and preserves OTP leading zeroes', () => {
    expect(
      mobilePhoneLoginVerifyInputSchema.parse({ code: '012345', phone: '+1 415 555 2671' }),
    ).toEqual({ code: '012345', phone: '+14155552671' });
  });
});
