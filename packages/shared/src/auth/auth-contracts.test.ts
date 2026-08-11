import { describe, expect, it } from 'vitest';

import {
  mobileForgotPasswordInputSchema,
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
      }),
    ).toMatchObject({ email: 'user@example.com', fullName: 'Ayesha Khan' });
  });

  it('rejects invalid email, weak passwords, and mismatched confirmation', () => {
    expect(() =>
      mobileSignupInputSchema.parse({
        confirmPassword: 'different',
        email: 'invalid',
        fullName: 'User',
        password: 'weak',
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
});
