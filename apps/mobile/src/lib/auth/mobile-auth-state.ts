import type { Session } from '@supabase/supabase-js';
import type {
  PhoneVerificationChallenge,
  PrivateUserAccount,
  PrivateUserProfile,
} from '@thriftage/shared';

export type MobileAuthState =
  | { readonly status: 'BOOTSTRAPPING' }
  | { readonly status: 'SIGNED_OUT' }
  | { readonly email: string; readonly status: 'EMAIL_VERIFICATION_PENDING' }
  | { readonly phone: string; readonly status: 'PHONE_LOGIN_PENDING' }
  | { readonly session: Session; readonly status: 'AUTHENTICATED_UNPROVISIONED' }
  | {
      readonly account: PrivateUserAccount;
      readonly challenge: PhoneVerificationChallenge | null;
      readonly session: Session;
      readonly status: 'PHONE_VERIFICATION_REQUIRED';
      readonly suggestedPhone: string | null;
    }
  | {
      readonly account: PrivateUserAccount;
      readonly session: Session;
      readonly status: 'PROFILE_ONBOARDING_REQUIRED';
    }
  | {
      readonly account: PrivateUserAccount;
      readonly profile: PrivateUserProfile;
      readonly session: Session;
      readonly status: 'AUTHENTICATED_ACTIVE';
    }
  | { readonly session: Session; readonly status: 'ACCOUNT_SUSPENDED' }
  | { readonly session: Session; readonly status: 'ACCOUNT_DEACTIVATED' }
  | { readonly session: Session; readonly status: 'PASSWORD_RECOVERY' };

export type MobileAuthRoute =
  | '/(app)'
  | '/(auth)/complete-account'
  | '/(auth)/login'
  | '/(auth)/phone-login'
  | '/(auth)/phone-verification'
  | '/(auth)/profile-onboarding'
  | '/(auth)/reset-password'
  | '/(auth)/verify-email'
  | '/(blocked)';

export function routeForAuthState(state: MobileAuthState): MobileAuthRoute {
  switch (state.status) {
    case 'BOOTSTRAPPING':
    case 'SIGNED_OUT':
      return '/(auth)/login';
    case 'EMAIL_VERIFICATION_PENDING':
      return '/(auth)/verify-email';
    case 'PHONE_LOGIN_PENDING':
      return '/(auth)/phone-login';
    case 'AUTHENTICATED_UNPROVISIONED':
      return '/(auth)/complete-account';
    case 'PHONE_VERIFICATION_REQUIRED':
      return '/(auth)/phone-verification';
    case 'PROFILE_ONBOARDING_REQUIRED':
      return '/(auth)/profile-onboarding';
    case 'AUTHENTICATED_ACTIVE':
      return '/(app)';
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_DEACTIVATED':
      return '/(blocked)';
    case 'PASSWORD_RECOVERY':
      return '/(auth)/reset-password';
  }
}
