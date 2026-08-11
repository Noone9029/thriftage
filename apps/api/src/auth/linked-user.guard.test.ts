import type { ExecutionContext } from '@nestjs/common';
import type { User } from '@thriftage/db';
import { describe, expect, it, vi } from 'vitest';

import type {
  ApplicationUserResolution,
  ApplicationUserResolver,
} from './application-user-resolver.service';
import type { AuthenticatedHttpRequest, AuthenticatedIdentity } from './auth.types';
import { LinkedUserGuard } from './linked-user.guard';

const identity: AuthenticatedIdentity = {
  assuranceLevel: null,
  authProviderUserId: 'provider-user-id',
  email: null,
  phone: null,
  sessionId: null,
};

const activeUser: User = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-user-id',
  createdAt: new Date('2026-08-10T00:00:00Z'),
  deletedAt: null,
  email: null,
  emailVerified: false,
  fullName: 'Active User',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: null,
  phoneVerified: false,
  role: 'USER',
  updatedAt: new Date('2026-08-10T00:00:00Z'),
};

function context(request: AuthenticatedHttpRequest): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function resolverWith(result: ApplicationUserResolution): ApplicationUserResolver {
  return { resolve: vi.fn().mockResolvedValue(result) } as unknown as ApplicationUserResolver;
}

describe('LinkedUserGuard', () => {
  it.each([
    ['not_provisioned', 'AUTH_USER_NOT_PROVISIONED'],
    ['suspended', 'ACCOUNT_SUSPENDED'],
    ['deactivated', 'ACCOUNT_DEACTIVATED'],
  ] as const)('denies %s users with a distinct code', async (state, code) => {
    const resolution: ApplicationUserResolution =
      state === 'not_provisioned'
        ? { state }
        : {
            state,
            user: {
              ...activeUser,
              accountStatus: state === 'suspended' ? 'SUSPENDED' : 'DEACTIVATED',
            },
          };
    const guard = new LinkedUserGuard(resolverWith(resolution));

    await expect(
      guard.canActivate(context({ headers: {}, authContext: { accessToken: 'token', identity } })),
    ).rejects.toMatchObject({ code });
  });

  it('allows an active user and attaches the authoritative database record', async () => {
    const request: AuthenticatedHttpRequest = {
      authContext: { accessToken: 'token', identity },
      headers: {},
    };
    const guard = new LinkedUserGuard(resolverWith({ state: 'active', user: activeUser }));

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.currentUser).toBe(activeUser);
  });
});
