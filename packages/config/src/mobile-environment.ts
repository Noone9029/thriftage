import { z } from 'zod';

import {
  deploymentEnvironmentSchema,
  type DeploymentEnvironment,
  isPlaceholderValue,
  isSecureRemoteUrl,
} from './deployment-environment';

const mobileEnvironmentSchema = z
  .strictObject({
    accountDeletionUrl: z.string().trim().url().optional(),
    apiUrl: z.string().trim().url(),
    appScheme: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9+.-]*$/)
      .default('thriftage'),
    communityGuidelinesUrl: z.string().trim().url().optional(),
    deploymentEnvironment: deploymentEnvironmentSchema.default('local'),
    privacyPolicyUrl: z.string().trim().url().optional(),
    releaseVersion: z.string().trim().min(1).max(120).default('development'),
    sentryDsn: z.string().trim().url().optional(),
    sentryTracesSampleRate: z.coerce.number().min(0).max(1).default(0),
    supportUrl: z.string().trim().url().optional(),
    supabasePublishableKey: z
      .string()
      .trim()
      .regex(/^sb_publishable_[A-Za-z0-9_-]+$/, 'Expected a Supabase publishable key.'),
    supabaseUrl: z.string().trim().url(),
    termsOfUseUrl: z.string().trim().url().optional(),
  })
  .superRefine((environment, context) => {
    if (environment.deploymentEnvironment === 'local') return;

    for (const [name, value] of [
      ['accountDeletionUrl', environment.accountDeletionUrl],
      ['apiUrl', environment.apiUrl],
      ['communityGuidelinesUrl', environment.communityGuidelinesUrl],
      ['privacyPolicyUrl', environment.privacyPolicyUrl],
      ['sentryDsn', environment.sentryDsn],
      ['supportUrl', environment.supportUrl],
      ['supabaseUrl', environment.supabaseUrl],
      ['termsOfUseUrl', environment.termsOfUseUrl],
    ] as const) {
      if (value === undefined || !isSecureRemoteUrl(value)) {
        context.addIssue({
          code: 'custom',
          message: `${name} must be a non-placeholder HTTPS URL outside local development.`,
          path: [name],
        });
      }
    }

    if (
      environment.releaseVersion === 'development' ||
      isPlaceholderValue(environment.releaseVersion)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'releaseVersion must identify the deployed build.',
        path: ['releaseVersion'],
      });
    }
    if (isPlaceholderValue(environment.supabasePublishableKey)) {
      context.addIssue({
        code: 'custom',
        message: 'supabasePublishableKey must not contain a development placeholder.',
        path: ['supabasePublishableKey'],
      });
    }
  });

export interface MobileConfig {
  readonly accountDeletionUrl?: string;
  readonly apiUrl: string;
  readonly appScheme: string;
  readonly communityGuidelinesUrl?: string;
  readonly deploymentEnvironment: DeploymentEnvironment;
  readonly privacyPolicyUrl?: string;
  readonly releaseVersion: string;
  readonly sentryDsn?: string;
  readonly sentryTracesSampleRate: number;
  readonly supportUrl?: string;
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
  readonly termsOfUseUrl?: string;
}

export function loadMobileConfig(environment: {
  readonly accountDeletionUrl?: string | undefined;
  readonly apiUrl: string | undefined;
  readonly appScheme?: string | undefined;
  readonly communityGuidelinesUrl?: string | undefined;
  readonly deploymentEnvironment?: string | undefined;
  readonly privacyPolicyUrl?: string | undefined;
  readonly releaseVersion?: string | undefined;
  readonly sentryDsn?: string | undefined;
  readonly sentryTracesSampleRate?: string | number | undefined;
  readonly supportUrl?: string | undefined;
  readonly supabasePublishableKey: string | undefined;
  readonly supabaseUrl: string | undefined;
  readonly termsOfUseUrl?: string | undefined;
}): MobileConfig {
  const parsed = mobileEnvironmentSchema.parse(environment);
  return Object.freeze({
    ...(parsed.accountDeletionUrl === undefined
      ? {}
      : { accountDeletionUrl: parsed.accountDeletionUrl.replace(/\/$/, '') }),
    apiUrl: parsed.apiUrl.replace(/\/$/, ''),
    appScheme: parsed.appScheme,
    ...(parsed.communityGuidelinesUrl === undefined
      ? {}
      : { communityGuidelinesUrl: parsed.communityGuidelinesUrl.replace(/\/$/, '') }),
    deploymentEnvironment: parsed.deploymentEnvironment,
    ...(parsed.privacyPolicyUrl === undefined
      ? {}
      : { privacyPolicyUrl: parsed.privacyPolicyUrl.replace(/\/$/, '') }),
    releaseVersion: parsed.releaseVersion,
    ...(parsed.sentryDsn === undefined ? {} : { sentryDsn: parsed.sentryDsn }),
    sentryTracesSampleRate: parsed.sentryTracesSampleRate,
    ...(parsed.supportUrl === undefined
      ? {}
      : { supportUrl: parsed.supportUrl.replace(/\/$/, '') }),
    supabasePublishableKey: parsed.supabasePublishableKey,
    supabaseUrl: parsed.supabaseUrl.replace(/\/$/, ''),
    ...(parsed.termsOfUseUrl === undefined
      ? {}
      : { termsOfUseUrl: parsed.termsOfUseUrl.replace(/\/$/, '') }),
  });
}
