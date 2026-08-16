import 'react-native-url-polyfill/auto';

import { createClient, processLock, type EmailOtpType, type Session } from '@supabase/supabase-js';

import { mobileConfig } from '../../config/mobile-config';
import type { AuthCallbackInstruction, AuthCallbackKind } from './deep-link';
import type { MobileAuthGateway } from './mobile-auth.gateway';
import { authStorage } from './storage/auth-storage';
import { createPhoneSignInRequest } from './supabase-phone-sign-in';

export const EMAIL_CONFIRMATION_REDIRECT_URL = `${mobileConfig.appScheme}://auth/callback`;
export const PASSWORD_RECOVERY_REDIRECT_URL = `${mobileConfig.appScheme}://auth/reset-password`;

export const supabaseClient = createClient(
  mobileConfig.supabaseUrl,
  mobileConfig.supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
      persistSession: true,
      storage: authStorage,
    },
  },
);

function requireSession(session: Session | null): Session {
  if (session === null) {
    throw new Error('Supabase did not establish an authentication session.');
  }
  return session;
}

class SupabaseMobileAuthGateway implements MobileAuthGateway {
  public async getSession(): Promise<Session | null> {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error !== null) {
      throw error;
    }
    return data.session;
  }

  public async signUpWithPassword(
    email: string,
    password: string,
    redirectTo: string,
  ): Promise<Session | null> {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      options: { emailRedirectTo: redirectTo },
      password,
    });
    if (error !== null) {
      throw error;
    }
    return data.session;
  }

  public async signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error !== null) {
      throw error;
    }
    return requireSession(data.session);
  }

  public async startPhoneSignIn(phone: string): Promise<void> {
    const { error } = await supabaseClient.auth.signInWithOtp(createPhoneSignInRequest(phone));
    if (error !== null) throw error;
  }

  public async verifyPhoneSignIn(phone: string, code: string): Promise<Session> {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });
    if (error !== null) throw error;
    return requireSession(data.session);
  }

  public async signOut(): Promise<void> {
    const { error } = await supabaseClient.auth.signOut();
    if (error !== null) {
      const localResult = await supabaseClient.auth.signOut({ scope: 'local' });
      if (localResult.error !== null) throw error;
    }
  }

  public async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error !== null) {
      throw error;
    }
  }

  public async updatePassword(password: string): Promise<void> {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error !== null) {
      throw error;
    }
  }

  public async refreshSession(): Promise<Session | null> {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (error !== null) {
      throw error;
    }
    return data.session;
  }

  public subscribe(listener: Parameters<MobileAuthGateway['subscribe']>[0]): () => void {
    const { data } = supabaseClient.auth.onAuthStateChange(listener);
    return () => data.subscription.unsubscribe();
  }

  public startAutoRefresh(): void {
    supabaseClient.auth.startAutoRefresh();
  }

  public stopAutoRefresh(): void {
    supabaseClient.auth.stopAutoRefresh();
  }

  public async exchangeCallback(instruction: AuthCallbackInstruction): Promise<{
    readonly kind: AuthCallbackKind;
    readonly session: Session;
  }> {
    if (instruction.action === 'set-session') {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: instruction.accessToken,
        refresh_token: instruction.refreshToken,
      });
      if (error !== null) throw error;
      return { kind: instruction.kind, session: requireSession(data.session) };
    }
    if (instruction.action === 'exchange-code') {
      const { data, error } = await supabaseClient.auth.exchangeCodeForSession(instruction.code);
      if (error !== null) throw error;
      return { kind: instruction.kind, session: requireSession(data.session) };
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
      token_hash: instruction.tokenHash,
      type: instruction.type as EmailOtpType,
    });
    if (error !== null) throw error;
    return { kind: instruction.kind, session: requireSession(data.session) };
  }
}

export const mobileAuthGateway: MobileAuthGateway = new SupabaseMobileAuthGateway();
