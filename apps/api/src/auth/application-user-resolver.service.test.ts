import type { PrismaClient, User } from '@thriftage/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationUserResolver } from './application-user-resolver.service';
import type { AuthenticatedIdentity } from './auth.types';

const identity: AuthenticatedIdentity = {
  assuranceLevel: 'aal1',
  authProviderUserId: 'provider-user-id',
  email: 'verified@example.com',
  phone: null,
  sessionId: 'session-id',
};

const activeUser: User = {
  accountStatus: 'ACTIVE',
  authProviderUserId: identity.authProviderUserId,
  createdAt: new Date('2026-08-10T00:00:00Z'),
  deletedAt: null,
  email: identity.email,
  emailVerified: true,
  fullName: 'Verified User',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: null,
  phoneVerified: false,
  role: 'USER',
  updatedAt: new Date('2026-08-10T00:00:00Z'),
};

function resolverWith(findUnique: ReturnType<typeof vi.fn>): ApplicationUserResolver {
  return new ApplicationUserResolver({ user: { findUnique } } as unknown as PrismaClient);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ApplicationUserResolver', () => {
  it('coalesces concurrent authoritative lookups and briefly caches active standard users', async () => {
    let finish: ((user: User) => void) | undefined;
    const findUnique = vi.fn().mockReturnValue(
      new Promise<User>((resolve) => {
        finish = resolve;
      }),
    );
    const resolver = resolverWith(findUnique);

    const first = resolver.resolve(identity);
    const second = resolver.resolve(identity);
    expect(findUnique).toHaveBeenCalledTimes(1);
    finish?.(activeUser);

    await expect(Promise.all([first, second])).resolves.toEqual([
      { state: 'active', user: activeUser },
      { state: 'active', user: activeUser },
    ]);
    await expect(resolver.resolve(identity)).resolves.toEqual({
      state: 'active',
      user: activeUser,
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('expires the active standard-user cache after two seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T00:00:00Z'));
    const findUnique = vi.fn().mockResolvedValue(activeUser);
    const resolver = resolverWith(findUnique);

    await resolver.resolve(identity);
    vi.advanceTimersByTime(2_001);
    await resolver.resolve(identity);

    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ...activeUser, role: 'ADMIN' as const },
    { ...activeUser, accountStatus: 'SUSPENDED' as const },
    { ...activeUser, accountStatus: 'DEACTIVATED' as const },
    null,
  ])('does not cache privileged, unavailable, or non-active resolution %#', async (user) => {
    const findUnique = vi.fn().mockResolvedValue(user);
    const resolver = resolverWith(findUnique);

    await resolver.resolve(identity);
    await resolver.resolve(identity);

    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
