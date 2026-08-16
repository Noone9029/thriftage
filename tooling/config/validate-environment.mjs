import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'dotenv';

import { loadApiConfig, loadMobileConfig } from '../../packages/config/dist/index.js';

const [kind, file] = process.argv.slice(2).filter((argument) => argument !== '--');
if (!['api', 'mobile'].includes(kind) || !file) {
  console.error('Usage: node tooling/config/validate-environment.mjs <api|mobile> <env-file>');
  process.exit(2);
}

const environment = parse(readFileSync(resolve(file)));

try {
  if (kind === 'api') {
    const config = loadApiConfig(environment);
    console.log(
      `API environment is valid: ${config.deploymentEnvironment} / ${config.releaseVersion}.`,
    );
  } else {
    const config = loadMobileConfig({
      accountDeletionUrl: environment.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
      apiUrl: environment.EXPO_PUBLIC_API_URL,
      appScheme: environment.EXPO_PUBLIC_APP_SCHEME,
      communityGuidelinesUrl: environment.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL,
      deploymentEnvironment: environment.EXPO_PUBLIC_DEPLOYMENT_ENV,
      privacyPolicyUrl: environment.EXPO_PUBLIC_PRIVACY_POLICY_URL,
      releaseVersion: environment.EXPO_PUBLIC_RELEASE_VERSION,
      sentryDsn: environment.EXPO_PUBLIC_SENTRY_DSN,
      sentryTracesSampleRate: environment.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      supportUrl: environment.EXPO_PUBLIC_SUPPORT_URL,
      supabasePublishableKey: environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      supabaseUrl: environment.EXPO_PUBLIC_SUPABASE_URL,
      termsOfUseUrl: environment.EXPO_PUBLIC_TERMS_OF_USE_URL,
    });
    console.log(
      `Mobile environment is valid: ${config.deploymentEnvironment} / ${config.releaseVersion}.`,
    );
  }
} catch (error) {
  console.error(`Environment validation failed for ${kind}.`);
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues)) {
    for (const issue of error.issues) {
      console.error(`- ${issue.path?.join('.') || 'environment'}: ${issue.message}`);
    }
  }
  process.exitCode = 1;
}
