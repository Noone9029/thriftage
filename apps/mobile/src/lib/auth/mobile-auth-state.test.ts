import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { routeForAuthState, type MobileAuthState } from './mobile-auth-state';

const session = {} as Session;

describe('routeForAuthState', () => {
  it.each([
    [{ status: 'SIGNED_OUT' }, '/(auth)/login'],
    [{ email: 'user@example.com', status: 'EMAIL_VERIFICATION_PENDING' }, '/(auth)/verify-email'],
    [{ session, status: 'AUTHENTICATED_UNPROVISIONED' }, '/(auth)/complete-account'],
    [{ session, status: 'ACCOUNT_SUSPENDED' }, '/(blocked)'],
    [{ session, status: 'ACCOUNT_DEACTIVATED' }, '/(blocked)'],
    [{ session, status: 'PASSWORD_RECOVERY' }, '/(auth)/reset-password'],
  ] as const)('maps explicit authentication states to protected route sets', (state, route) => {
    expect(routeForAuthState(state as MobileAuthState)).toBe(route);
  });
});
