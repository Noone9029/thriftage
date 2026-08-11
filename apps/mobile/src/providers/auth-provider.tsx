import type {
  MobileForgotPasswordInput,
  MobileLoginInput,
  MobileResetPasswordInput,
  MobileSignupInput,
} from '@thriftage/shared';
import * as Linking from 'expo-linking';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState, Platform } from 'react-native';

import { mobileAuthController } from '../lib/auth/auth-composition';
import { getMobileAuthErrorMessage } from '../lib/auth/auth-error-message';
import { registerAuthStateListener } from '../lib/auth/auth-state-listener';
import { parseAuthCallbackUrl } from '../lib/auth/deep-link';
import type { MobileAuthState } from '../lib/auth/mobile-auth-state';
import { registerSessionAutoRefresh } from '../lib/auth/session-auto-refresh';
import { mobileAuthGateway } from '../lib/auth/supabase-client';

interface AuthContextValue {
  readonly abandonSignup: () => Promise<void>;
  readonly clearDeepLinkError: () => void;
  readonly completeAccount: (fullName: string) => Promise<void>;
  readonly deepLinkError: string | null;
  readonly finishPasswordRecovery: () => Promise<void>;
  readonly requestPasswordReset: (input: MobileForgotPasswordInput) => Promise<void>;
  readonly signIn: (input: MobileLoginInput) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly signUp: (input: MobileSignupInput) => Promise<void>;
  readonly state: MobileAuthState;
  readonly updatePassword: (input: MobileResetPasswordInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'thriftage:' && parsed.hostname === 'auth';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(
    mobileAuthController.subscribe,
    mobileAuthController.getSnapshot,
    mobileAuthController.getSnapshot,
  );
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const processUrl = async (url: string): Promise<boolean> => {
      if (!isAuthCallback(url)) return false;
      try {
        setDeepLinkError(null);
        await mobileAuthController.handleCallback(parseAuthCallbackUrl(url));
        return true;
      } catch (error: unknown) {
        if (active) setDeepLinkError(getMobileAuthErrorMessage(error));
        return false;
      }
    };

    const unsubscribeAuth = registerAuthStateListener(
      mobileAuthGateway,
      (event, session) => mobileAuthController.handleAuthChange(event, session),
      (error) => {
        if (active) setDeepLinkError(getMobileAuthErrorMessage(error));
      },
    );
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void processUrl(url);
    });
    const unregisterAutoRefresh =
      Platform.OS === 'web'
        ? () => undefined
        : registerSessionAutoRefresh(
            {
              addEventListener: (_event, listener) =>
                AppState.addEventListener('change', (nextState) => listener(nextState)),
              currentState: AppState.currentState,
            },
            mobileAuthGateway,
          );

    void Linking.getInitialURL().then(async (initialUrl) => {
      if (initialUrl !== null && isAuthCallback(initialUrl)) {
        const establishedSession = await processUrl(initialUrl);
        if (!establishedSession) await mobileAuthController.bootstrap();
      } else {
        await mobileAuthController.bootstrap();
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
      linkSubscription.remove();
      unregisterAutoRefresh();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      abandonSignup: () => mobileAuthController.abandonSignup(),
      clearDeepLinkError: () => setDeepLinkError(null),
      completeAccount: (fullName) => mobileAuthController.completeAccount(fullName),
      deepLinkError,
      finishPasswordRecovery: () => mobileAuthController.finishPasswordRecovery(),
      requestPasswordReset: (input) => mobileAuthController.requestPasswordReset(input),
      signIn: (input) => mobileAuthController.signIn(input),
      signOut: () => mobileAuthController.signOut(),
      signUp: (input) => mobileAuthController.signUp(input),
      state,
      updatePassword: (input) => mobileAuthController.updatePassword(input),
    }),
    [deepLinkError, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
