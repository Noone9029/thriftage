import type { Session } from '@supabase/supabase-js';
import type { PrivateUserAccount } from '@thriftage/shared';

export type MobileAuthState =
  | { readonly status: 'BOOTSTRAPPING' }
  | { readonly status: 'SIGNED_OUT' }
  | { readonly email: string; readonly status: 'EMAIL_VERIFICATION_PENDING' }
  | { readonly session: Session; readonly status: 'AUTHENTICATED_UNPROVISIONED' }
  | {
      readonly account: PrivateUserAccount;
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
    case 'AUTHENTICATED_UNPROVISIONED':
      return '/(auth)/complete-account';
    case 'AUTHENTICATED_ACTIVE':
      return '/(app)';
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_DEACTIVATED':
      return '/(blocked)';
    case 'PASSWORD_RECOVERY':
      return '/(auth)/reset-password';
  }
}
