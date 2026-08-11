import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationGuard } from './authentication.guard';
import { AuthTokenVerificationError, type AuthTokenVerifier } from './auth-provider.interface';
import type { AuthenticatedHttpRequest, AuthenticatedIdentity } from './auth.types';

const identity: AuthenticatedIdentity = {
  assuranceLevel: 'aal1',
  authProviderUserId: 'provider-user-id',
  email: null,
  phone: null,
  sessionId: 'session-id',
};

function executionContext(request: AuthenticatedHttpRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthenticationGuard', () => {
  it('attaches a normalized identity and token to request context', async () => {
    const verifier: AuthTokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue(identity),
    };
    const request: AuthenticatedHttpRequest = {
      headers: { authorization: 'Bearer verified-token' },
    };

    await expect(
      new AuthenticationGuard(verifier).canActivate(executionContext(request)),
    ).resolves.toBe(true);
    expect(request.authContext).toEqual({ accessToken: 'verified-token', identity });
  });

  it.each([
    ['invalid', new AuthTokenVerificationError('invalid', 'invalid'), 'AUTH_INVALID_TOKEN'],
    ['expired', new AuthTokenVerificationError('expired', 'expired'), 'AUTH_EXPIRED_TOKEN'],
  ])('maps %s verifier errors to stable API codes', async (_name, error, code) => {
    const verifier: AuthTokenVerifier = {
      verifyAccessToken: vi.fn().mockRejectedValue(error),
    };
    const guard = new AuthenticationGuard(verifier);

    await expect(
      guard.canActivate(executionContext({ headers: { authorization: 'Bearer rejected-token' } })),
    ).rejects.toMatchObject({ code });
  });
});
