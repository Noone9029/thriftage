import type {
  AccountDeletionStatus,
  MobileForgotPasswordInput,
  MobileLoginInput,
  MobilePhoneLoginStartInput,
  MobilePhoneLoginVerifyInput,
  MobileResetPasswordInput,
  MobileSignupInput,
  ProfileCreateInput,
  ProfileUpdateInput,
  PublicUserProfile,
  UsernameAvailability,
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

import { mobileConfig } from '../config/mobile-config';
import { MobileApiError } from '../lib/api/mobile-api-error';
import { mobileAuthController, thriftageApiClient } from '../lib/auth/auth-composition';
import { deactivateCurrentPushDevice } from '../lib/notifications/push-registration';
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
  readonly completeProfile: (input: ProfileCreateInput, image: FormData | null) => Promise<void>;
  readonly deepLinkError: string | null;
  readonly finishPasswordRecovery: () => Promise<void>;
  readonly getPublicProfile: (username: string) => Promise<PublicUserProfile>;
  readonly getUsernameAvailability: (username: string) => Promise<UsernameAvailability>;
  readonly requestPasswordReset: (input: MobileForgotPasswordInput) => Promise<void>;
  readonly resendPhoneLogin: () => Promise<void>;
  readonly resendRequiredPhone: () => Promise<void>;
  readonly startPhoneLogin: (input: MobilePhoneLoginStartInput) => Promise<void>;
  readonly startPhoneVerification: (phone: string) => Promise<void>;
  readonly signIn: (input: MobileLoginInput) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly signUp: (input: MobileSignupInput) => Promise<void>;
  readonly state: MobileAuthState;
  readonly updatePassword: (input: MobileResetPasswordInput) => Promise<void>;
  readonly updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  readonly uploadProfileImage: (image: FormData) => Promise<void>;
  readonly removeProfileImage: () => Promise<void>;
  readonly requestAccountDeletion: (password: string) => Promise<AccountDeletionStatus>;
  readonly verifyPhoneLogin: (input: MobilePhoneLoginVerifyInput) => Promise<void>;
  readonly verifyRequiredPhone: (code: string) => Promise<void>;
  readonly abandonPhoneLogin: () => void;
  readonly cancelRequiredPhone: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${mobileConfig.appScheme}:` && parsed.hostname === 'auth';
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
        await mobileAuthController.handleCallback(
          parseAuthCallbackUrl(url, mobileConfig.appScheme),
        );
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
      abandonPhoneLogin: () => mobileAuthController.abandonPhoneLogin(),
      cancelRequiredPhone: () => mobileAuthController.cancelRequiredPhone(),
      clearDeepLinkError: () => setDeepLinkError(null),
      completeAccount: (fullName) => mobileAuthController.completeAccount(fullName),
      completeProfile: (input, image) => mobileAuthController.completeProfile(input, image),
      deepLinkError,
      finishPasswordRecovery: () => mobileAuthController.finishPasswordRecovery(),
      getPublicProfile: (username) => thriftageApiClient.getPublicProfile(username),
      getUsernameAvailability: (username) => thriftageApiClient.getUsernameAvailability(username),
      requestPasswordReset: (input) => mobileAuthController.requestPasswordReset(input),
      removeProfileImage: () => mobileAuthController.removeProfileImage(),
      requestAccountDeletion: async (password) => {
        if (state.status !== 'AUTHENTICATED_ACTIVE') {
          throw new Error('An active account is required to request deletion.');
        }
        if (state.account.email !== null) {
          await mobileAuthGateway.signInWithPassword(state.account.email, password);
        }
        return thriftageApiClient.requestAccountDeletion();
      },
      resendPhoneLogin: () => mobileAuthController.resendPhoneLogin(),
      resendRequiredPhone: () => mobileAuthController.resendRequiredPhone(),
      signIn: (input) => mobileAuthController.signIn(input),
      signOut: async () => {
        await deactivateCurrentPushDevice().catch(() => undefined);
        await mobileAuthController.signOut();
      },
      signUp: async (input) => {
        const runtime = await thriftageApiClient.getRuntimeConfig();
        if (!runtime.features.registration) {
          throw new MobileApiError(
            'AUTH_REGISTRATION_DISABLED',
            'New account registration is temporarily unavailable.',
            503,
          );
        }
        await mobileAuthController.signUp(input);
      },
      startPhoneLogin: async (input) => {
        const runtime = await thriftageApiClient.getRuntimeConfig();
        if (!runtime.features.phoneAuth) {
          throw new MobileApiError(
            'PHONE_AUTH_DISABLED',
            'Phone authentication is temporarily unavailable.',
            503,
          );
        }
        await mobileAuthController.startPhoneLogin(input);
      },
      startPhoneVerification: (phone) => mobileAuthController.startPhoneVerification(phone),
      state,
      updatePassword: (input) => mobileAuthController.updatePassword(input),
      updateProfile: (input) => mobileAuthController.updateProfile(input),
      uploadProfileImage: (image) => mobileAuthController.uploadProfileImage(image),
      verifyPhoneLogin: (input) => mobileAuthController.verifyPhoneLogin(input),
      verifyRequiredPhone: (code) => mobileAuthController.verifyRequiredPhone(code),
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
