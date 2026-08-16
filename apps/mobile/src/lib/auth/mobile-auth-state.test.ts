import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { routeForAuthState, type MobileAuthState } from './mobile-auth-state';
import type { PrivateUserAccount, PrivateUserProfile } from '@thriftage/shared';

const session = {} as Session;
const account = {} as PrivateUserAccount;
const profile = {} as PrivateUserProfile;

describe('routeForAuthState', () => {
  it.each([
    [{ status: 'SIGNED_OUT' }, '/(auth)/login'],
    [{ email: 'user@example.com', status: 'EMAIL_VERIFICATION_PENDING' }, '/(auth)/verify-email'],
    [{ phone: '+923001234567', status: 'PHONE_LOGIN_PENDING' }, '/(auth)/phone-login'],
    [{ session, status: 'AUTHENTICATED_UNPROVISIONED' }, '/(auth)/complete-account'],
    [
      {
        account,
        challenge: null,
        session,
        status: 'PHONE_VERIFICATION_REQUIRED',
        suggestedPhone: null,
      },
      '/(auth)/phone-verification',
    ],
    [{ account, session, status: 'PROFILE_ONBOARDING_REQUIRED' }, '/(auth)/profile-onboarding'],
    [{ account, profile, session, status: 'AUTHENTICATED_ACTIVE' }, '/'],
    [{ session, status: 'ACCOUNT_SUSPENDED' }, '/(blocked)'],
    [{ session, status: 'ACCOUNT_DEACTIVATED' }, '/(blocked)'],
    [{ session, status: 'PASSWORD_RECOVERY' }, '/(auth)/reset-password'],
  ] as const)('maps explicit authentication states to protected route sets', (state, route) => {
    expect(routeForAuthState(state as MobileAuthState)).toBe(route);
  });
});
