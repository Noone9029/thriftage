import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthTokenVerificationError } from './auth-provider.interface';
import { SupabaseAuthAdapter, type SupabaseAuthClient } from './supabase-auth.adapter';

const expectedIssuer = 'https://project-ref.supabase.co/auth/v1';
const futureExpiration = () => Math.floor(Date.now() / 1_000) + 3_600;

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aal: 'aal1',
    aud: 'authenticated',
    email: 'User@Example.com',
    exp: futureExpiration(),
    is_anonymous: false,
    iss: expectedIssuer,
    phone: '+923001234567',
    role: 'authenticated',
    session_id: 'session-id',
    sub: 'provider-user-id',
    ...overrides,
  };
}

describe('SupabaseAuthAdapter', () => {
  let getClaims: Mock<(accessToken: string) => Promise<unknown>>;
  let getUser: Mock<(accessToken: string) => Promise<unknown>>;
  let adapter: SupabaseAuthAdapter;

  beforeEach(() => {
    getClaims = vi.fn<(accessToken: string) => Promise<unknown>>();
    getUser = vi.fn<(accessToken: string) => Promise<unknown>>();
    const client: SupabaseAuthClient = { getClaims, getUser };
    adapter = new SupabaseAuthAdapter(client, expectedIssuer);
  });

  it('normalizes verified authenticated-user claims', async () => {
    getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });

    await expect(adapter.verifyAccessToken('verified-jwt')).resolves.toEqual({
      assuranceLevel: 'aal1',
      authProviderUserId: 'provider-user-id',
      email: 'User@Example.com',
      phone: '+923001234567',
      sessionId: 'session-id',
    });
    expect(getClaims).toHaveBeenCalledWith('verified-jwt');
  });

  it.each([
    ['missing subject', { sub: '   ' }],
    ['wrong issuer', { iss: 'https://other-project.supabase.co/auth/v1' }],
    ['wrong audience', { aud: 'anon' }],
    ['service role', { role: 'service_role' }],
    ['anonymous identity', { is_anonymous: true }],
  ])('rejects %s', async (_caseName, overrides) => {
    getClaims.mockResolvedValue({ data: { claims: claims(overrides) }, error: null });

    await expect(adapter.verifyAccessToken('rejected-jwt')).rejects.toMatchObject({
      failureCode: 'invalid',
    });
  });

  it('maps expired claims and provider failures distinctly', async () => {
    getClaims.mockResolvedValueOnce({
      data: { claims: claims({ exp: Math.floor(Date.now() / 1_000) - 1 }) },
      error: null,
    });
    await expect(adapter.verifyAccessToken('expired-jwt')).rejects.toMatchObject({
      failureCode: 'expired',
    });

    getClaims.mockResolvedValueOnce({ data: null, error: { message: 'JWT expired' } });
    await expect(adapter.verifyAccessToken('provider-expired-jwt')).rejects.toBeInstanceOf(
      AuthTokenVerificationError,
    );
  });

  it('maps failed signature verification to an invalid token', async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: 'bad signature' } });

    await expect(adapter.verifyAccessToken('invalid-jwt')).rejects.toMatchObject({
      failureCode: 'invalid',
    });
  });

  it('uses getUser for authoritative provisioning fields', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          email: 'user@example.com',
          email_confirmed_at: '2026-08-10T00:00:00Z',
          id: 'provider-user-id',
          is_anonymous: false,
          phone: '+923001234567',
          phone_confirmed_at: null,
        },
      },
      error: null,
    });

    await expect(adapter.getUser('verified-jwt')).resolves.toEqual({
      authProviderUserId: 'provider-user-id',
      email: 'user@example.com',
      emailVerified: true,
      phone: '+923001234567',
      phoneVerified: false,
    });
    expect(getUser).toHaveBeenCalledWith('verified-jwt');
  });

  it('preserves expired-token errors from the authoritative lookup', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT has expired' },
    });

    await expect(adapter.getUser('expired-jwt')).rejects.toMatchObject({
      failureCode: 'expired',
    });
  });
});
