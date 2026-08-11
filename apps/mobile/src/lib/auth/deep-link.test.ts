import { describe, expect, it } from 'vitest';

import { AuthCallbackError, parseAuthCallbackUrl } from './deep-link';

describe('parseAuthCallbackUrl', () => {
  it('accepts a valid confirmation session fragment', () => {
    expect(
      parseAuthCallbackUrl(
        'thriftage://auth/callback#access_token=access&refresh_token=refresh&type=signup',
      ),
    ).toEqual({
      accessToken: 'access',
      action: 'set-session',
      kind: 'confirmation',
      refreshToken: 'refresh',
    });
  });

  it('accepts a password-recovery session fragment', () => {
    expect(
      parseAuthCallbackUrl(
        'thriftage://auth/reset-password#access_token=access&refresh_token=refresh&type=recovery',
      ),
    ).toMatchObject({ action: 'set-session', kind: 'recovery' });
  });

  it('accepts supported PKCE codes and email token hashes', () => {
    expect(parseAuthCallbackUrl('thriftage://auth/callback?code=pkce-code')).toEqual({
      action: 'exchange-code',
      code: 'pkce-code',
      kind: 'confirmation',
    });
    expect(parseAuthCallbackUrl('thriftage://auth/callback?token_hash=hash&type=signup')).toEqual({
      action: 'verify-otp',
      kind: 'confirmation',
      tokenHash: 'hash',
      type: 'signup',
    });
  });

  it.each([
    ['malformed URL', 'not a URL'],
    ['arbitrary app route', 'thriftage://marketplace/listing?code=attack'],
    ['wrong scheme', 'https://example.com/auth/callback?code=attack'],
    ['missing credentials', 'thriftage://auth/callback'],
    ['partial session', 'thriftage://auth/callback#access_token=only'],
  ])('rejects %s', (_name, url) => {
    expect(() => parseAuthCallbackUrl(url)).toThrowError(AuthCallbackError);
  });

  it('maps provider error parameters without exposing arbitrary navigation', () => {
    expect(() =>
      parseAuthCallbackUrl(
        'thriftage://auth/callback#error=access_denied&error_description=raw-provider-copy&next=%2Fadmin',
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'PROVIDER_ERROR',
        message: 'The authentication link is expired, invalid, or already used.',
      }),
    );
  });
});
