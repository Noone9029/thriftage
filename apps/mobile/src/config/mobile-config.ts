import { loadMobileConfig } from '@thriftage/config/mobile';

export const mobileConfig = loadMobileConfig({
  accountDeletionUrl: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME,
  communityGuidelinesUrl: process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL,
  deploymentEnvironment: process.env.EXPO_PUBLIC_DEPLOYMENT_ENV,
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  releaseVersion: process.env.EXPO_PUBLIC_RELEASE_VERSION,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sentryTracesSampleRate: process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  termsOfUseUrl: process.env.EXPO_PUBLIC_TERMS_OF_USE_URL,
});
