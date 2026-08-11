import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import type { AuthCallbackInstruction, AuthCallbackKind } from './deep-link';

export interface MobileAuthGateway {
  exchangeCallback(instruction: AuthCallbackInstruction): Promise<{
    readonly kind: AuthCallbackKind;
    readonly session: Session;
  }>;
  getSession(): Promise<Session | null>;
  refreshSession(): Promise<Session | null>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<Session>;
  startPhoneSignIn(phone: string): Promise<void>;
  signOut(): Promise<void>;
  signUpWithPassword(email: string, password: string, redirectTo: string): Promise<Session | null>;
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
  subscribe(listener: (event: AuthChangeEvent, session: Session | null) => void): () => void;
  updatePassword(password: string): Promise<void>;
  verifyPhoneSignIn(phone: string, code: string): Promise<Session>;
}
