import { parseCommaSeparatedList } from '@thriftage/shared';
import { z } from 'zod';

import {
  deploymentEnvironmentSchema,
  type DeploymentEnvironment,
  isPlaceholderValue,
  isSecureRemoteUrl,
} from './deployment-environment';

const apiEnvironmentSchema = z
  .object({
    ACCOUNT_DELETION_ENABLED: z.enum(['true', 'false']).default('false'),
    ACCOUNT_DELETION_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(10),
    ACCOUNT_DELETION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(25).default(10),
    ACCOUNT_DELETION_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(5_000),
    ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3_600)
      .default(600),
    ACCOUNT_DELETION_STALE_LOCK_SECONDS: z.coerce.number().int().min(60).max(3_600).default(300),
    AI_STYLIST_CACHED_INPUT_COST_MICRO_USD_PER_MILLION: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(200_000),
    AI_STYLIST_DAILY_BUDGET_MICRO_USD: z.coerce.number().int().positive().optional(),
    AI_STYLIST_DAILY_USER_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
    AI_STYLIST_ENABLED: z.enum(['true', 'false']).default('false'),
    AI_STYLIST_INPUT_COST_MICRO_USD_PER_MILLION: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(2_000_000),
    AI_STYLIST_MAX_CONCURRENT_GENERATIONS: z.coerce.number().int().min(1).max(1000).default(50),
    AI_STYLIST_MAX_INPUT_CHARACTERS: z.coerce.number().int().min(200).max(10_000).default(2000),
    AI_STYLIST_MAX_OUTFIT_OPTIONS: z.coerce.number().int().min(1).max(3).default(3),
    AI_STYLIST_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(200).max(16_000).default(1800),
    AI_STYLIST_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(4),
    AI_STYLIST_MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(20).default(6),
    AI_STYLIST_MODEL: z.string().trim().min(1).max(100).default('gpt-5.6-terra'),
    AI_STYLIST_OUTPUT_COST_MICRO_USD_PER_MILLION: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(12_000_000),
    AI_STYLIST_REASONING_EFFORT: z
      .enum(['none', 'low', 'medium', 'high', 'xhigh', 'max'])
      .default('medium'),
    AI_STYLIST_SESSION_TURN_LIMIT: z.coerce.number().int().min(1).max(500).default(40),
    AI_STYLIST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    COD_ENABLED: z.enum(['true', 'false']).default('false'),
    COMMERCIAL_APPROVAL_REFERENCE: z.string().trim().min(8).max(255).optional(),
    COURIER_AGREEMENT_REFERENCE: z.string().trim().min(8).max(255).optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    CONVERSATION_MAX_STARTS_PER_DAY: z.coerce.number().int().min(1).max(100).default(25),
    CORS_ORIGINS: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DEPLOYMENT_ENV: deploymentEnvironmentSchema.default('local'),
    DISPUTE_EVIDENCE_BUCKET: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
      .default('dispute-evidence'),
    DISPUTE_EVIDENCE_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).optional(),
    DISPUTE_EVIDENCE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
    DISPUTE_SHIPPED_MIN_AGE_HOURS: z.coerce.number().int().min(0).max(720).default(72),
    DISPUTE_WINDOW_HOURS: z.coerce.number().int().min(1).max(8760).default(336),
    EXPO_PUSH_ACCESS_TOKEN: z.string().trim().min(16).optional(),
    EXPO_PUSH_ENABLED: z.enum(['true', 'false']).default('false'),
    LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
    LISTING_IMAGE_BUCKET: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
      .default('listing-images'),
    LISTING_IMAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    LOCAL_COURIER_ENABLED: z.enum(['true', 'false']).default('false'),
    LOCAL_COURIER_SERVICE_CITIES: z.string().trim().min(1).default('Lahore'),
    LOCAL_COURIER_SERVICE_COUNTRY_CODE: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .default('PK'),
    LAHORE_DELIVERY_FEE_MINOR: z.coerce.number().int().nonnegative().max(10_000_000).default(0),
    LAHORE_DELIVERY_RATE_VERSION: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{2,39}$/)
      .default('lahore-flat-v1'),
    MARKETPLACE_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(1_000),
    MESSAGE_MAX_BLOCKED_PER_HOUR: z.coerce.number().int().min(1).max(100).default(10),
    MESSAGE_MAX_SENDS_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    OPENAI_API_KEY: z.string().trim().min(16).optional(),
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
    OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(25).default(10),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(1000),
    PHONE_VERIFICATION_ATTEMPT_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(600),
    PHONE_VERIFICATION_MAX_CHECKS: z.coerce.number().int().min(1).max(10).default(5),
    PHONE_VERIFICATION_MAX_SENDS: z.coerce.number().int().min(1).max(10).default(5),
    PHONE_VERIFICATION_MAX_STARTS: z.coerce.number().int().min(1).max(20).default(5),
    PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(600)
      .default(60),
    PHONE_VERIFICATION_START_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(3_600),
    PROFILE_IMAGE_BUCKET: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
      .default('profile-images'),
    COMMUNITY_GUIDELINES_URL: z.string().trim().url().optional(),
    PRIVACY_POLICY_URL: z.string().trim().url().optional(),
    RELEASE_VERSION: z.string().trim().min(1).max(120).default('development'),
    REGISTRATION_ENABLED: z.enum(['true', 'false']).default('false'),
    PHONE_AUTH_ENABLED: z.enum(['true', 'false']).default('true'),
    PAYFAST_ENABLED: z.enum(['true', 'false']).default('false'),
    PAYFAST_LIVE_ENABLED: z.enum(['true', 'false']).default('false'),
    PAYFAST_CHECKOUT_URL: z.string().trim().url().optional(),
    PAYFAST_STATUS_URL: z.string().trim().url().optional(),
    PAYFAST_MERCHANT_ID: z.string().trim().min(4).max(255).optional(),
    PAYFAST_SIGNING_SECRET: z.string().trim().min(24).optional(),
    PAYFAST_MARKETPLACE_APPROVAL_REFERENCE: z.string().trim().min(8).max(255).optional(),
    PAYMENT_EXPIRY_MINUTES: z.coerce
      .number()
      .int()
      .refine((value) => value === 15, 'Hosted PayFast checkout expiry is fixed at 15 minutes.')
      .default(15),
    PAYOUTS_ENABLED: z.enum(['true', 'false']).default('false'),
    PAYOUT_ENCRYPTION_KEY: z.string().trim().min(43).max(44).optional(),
    PUSH_RECEIPT_DELAY_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REALTIME_BROADCAST_ENABLED: z.enum(['true', 'false']).default('false'),
    SELLER_VERIFICATION_MIN_COMPLETED_SALES: z.coerce.number().int().min(0).max(1000).default(0),
    SELLER_VERIFICATION_REAPPLY_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    SELLER_VERIFICATION_ENABLED: z.enum(['true', 'false']).default('false'),
    SENTRY_DSN: z.string().trim().url().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
    SUPPORT_URL: z.string().trim().url().optional(),
    SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .trim()
      .regex(/^sb_publishable_[A-Za-z0-9_-]+$/, 'Expected a Supabase publishable key.'),
    SUPABASE_SECRET_KEY: z
      .string()
      .trim()
      .regex(/^sb_secret_[A-Za-z0-9_-]+$/, 'Expected a Supabase secret key.'),
    SUPABASE_URL: z.string().trim().url(),
    TWILIO_ACCOUNT_SID: z
      .string()
      .trim()
      .regex(/^AC[A-Za-z0-9]{32}$/)
      .optional(),
    TWILIO_API_KEY_SECRET: z.string().trim().min(16).optional(),
    TWILIO_API_KEY_SID: z
      .string()
      .trim()
      .regex(/^SK[A-Za-z0-9]{32}$/)
      .optional(),
    TWILIO_VERIFY_SERVICE_SID: z
      .string()
      .trim()
      .regex(/^VA[A-Za-z0-9]{32}$/)
      .optional(),
    TERMS_OF_USE_URL: z.string().trim().url().optional(),
    ACCOUNT_DELETION_URL: z.string().trim().url().optional(),
    WITHHOLDING_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
    WITHHOLDING_RULE_VERSION: z.string().trim().min(1).max(40).default('withholding-unapproved-v1'),
  })
  .superRefine((environment, context) => {
    if (environment.MARKETPLACE_COMMISSION_BPS !== 1_000) {
      context.addIssue({
        code: 'custom',
        message: 'MARKETPLACE_COMMISSION_BPS is fixed at 1000 for the approved beta policy.',
        path: ['MARKETPLACE_COMMISSION_BPS'],
      });
    }
    if (environment.PAYFAST_LIVE_ENABLED === 'true' && environment.PAYFAST_ENABLED !== 'true') {
      context.addIssue({
        code: 'custom',
        message: 'PAYFAST_ENABLED must be true before live PayFast can be enabled.',
        path: ['PAYFAST_LIVE_ENABLED'],
      });
    }
    if (
      environment.PAYFAST_LIVE_ENABLED === 'true' &&
      environment.LOCAL_COURIER_ENABLED !== 'true'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'LOCAL_COURIER_ENABLED must be true before live PayFast can be enabled.',
        path: ['PAYFAST_LIVE_ENABLED'],
      });
    }
    if (environment.COD_ENABLED === 'true' && environment.LOCAL_COURIER_ENABLED !== 'true') {
      context.addIssue({
        code: 'custom',
        message: 'LOCAL_COURIER_ENABLED must be true before COD can be enabled.',
        path: ['COD_ENABLED'],
      });
    }
    if (environment.PAYOUTS_ENABLED === 'true' && environment.PAYOUT_ENCRYPTION_KEY === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'PAYOUT_ENCRYPTION_KEY is required when payouts are enabled.',
        path: ['PAYOUT_ENCRYPTION_KEY'],
      });
    }
    if (
      environment.WITHHOLDING_BPS > 0 &&
      environment.WITHHOLDING_RULE_VERSION.startsWith('withholding-unapproved')
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A counsel-approved WITHHOLDING_RULE_VERSION is required for non-zero withholding.',
        path: ['WITHHOLDING_RULE_VERSION'],
      });
    }
    if (environment.PHONE_AUTH_ENABLED === 'true') {
      for (const name of [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_API_KEY_SID',
        'TWILIO_API_KEY_SECRET',
        'TWILIO_VERIFY_SERVICE_SID',
      ] as const) {
        if (environment[name] === undefined) {
          context.addIssue({
            code: 'custom',
            message: `${name} is required when phone authentication is enabled.`,
            path: [name],
          });
        }
      }
    }

    if (environment.DEPLOYMENT_ENV === 'local') {
      if (environment.NODE_ENV === 'production') {
        context.addIssue({
          code: 'custom',
          message: 'DEPLOYMENT_ENV must be staging or production when NODE_ENV is production.',
          path: ['DEPLOYMENT_ENV'],
        });
      }
      return;
    }

    const validateSecureUrl = (
      name: keyof typeof environment,
      value: string | undefined,
      required: boolean,
    ): void => {
      if ((required && value === undefined) || (value !== undefined && !isSecureRemoteUrl(value))) {
        context.addIssue({
          code: 'custom',
          message: `${String(name)} must be a non-placeholder HTTPS URL${required ? '' : ' when configured'}.`,
          path: [name],
        });
      }
    };

    if (environment.NODE_ENV !== 'production') {
      context.addIssue({
        code: 'custom',
        message: 'NODE_ENV must be production for staging and production deployments.',
        path: ['NODE_ENV'],
      });
    }
    if (environment.LOG_FORMAT !== 'json') {
      context.addIssue({
        code: 'custom',
        message: 'LOG_FORMAT must be json outside local development.',
        path: ['LOG_FORMAT'],
      });
    }
    if (
      environment.RELEASE_VERSION === 'development' ||
      isPlaceholderValue(environment.RELEASE_VERSION)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'RELEASE_VERSION must identify the deployed commit or release.',
        path: ['RELEASE_VERSION'],
      });
    }

    const production = environment.DEPLOYMENT_ENV === 'production';
    if (
      production &&
      (environment.PAYFAST_LIVE_ENABLED === 'true' ||
        environment.COD_ENABLED === 'true' ||
        environment.PAYOUTS_ENABLED === 'true')
    ) {
      for (const name of [
        'COMMERCIAL_APPROVAL_REFERENCE',
        'PAYFAST_MARKETPLACE_APPROVAL_REFERENCE',
      ] as const) {
        if (environment[name] === undefined || isPlaceholderValue(environment[name])) {
          context.addIssue({
            code: 'custom',
            message: `${name} is required before production money movement.`,
            path: [name],
          });
        }
      }
    }
    if (
      production &&
      environment.LOCAL_COURIER_ENABLED === 'true' &&
      (environment.COURIER_AGREEMENT_REFERENCE === undefined ||
        isPlaceholderValue(environment.COURIER_AGREEMENT_REFERENCE))
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'COURIER_AGREEMENT_REFERENCE is required before the production courier is enabled.',
        path: ['COURIER_AGREEMENT_REFERENCE'],
      });
    }
    if (environment.PAYFAST_ENABLED === 'true') {
      for (const name of [
        'PAYFAST_CHECKOUT_URL',
        'PAYFAST_STATUS_URL',
        'PAYFAST_MERCHANT_ID',
        'PAYFAST_SIGNING_SECRET',
      ] as const) {
        if (environment[name] === undefined)
          context.addIssue({
            code: 'custom',
            message: `${name} is required when PayFast is enabled.`,
            path: [name],
          });
      }
    }
    validateSecureUrl('SUPABASE_URL', environment.SUPABASE_URL, true);
    validateSecureUrl('SUPPORT_URL', environment.SUPPORT_URL, production);
    validateSecureUrl('PRIVACY_POLICY_URL', environment.PRIVACY_POLICY_URL, production);
    validateSecureUrl('TERMS_OF_USE_URL', environment.TERMS_OF_USE_URL, production);
    validateSecureUrl('COMMUNITY_GUIDELINES_URL', environment.COMMUNITY_GUIDELINES_URL, production);
    validateSecureUrl('ACCOUNT_DELETION_URL', environment.ACCOUNT_DELETION_URL, production);
    validateSecureUrl('SENTRY_DSN', environment.SENTRY_DSN, production);

    const origins = parseCommaSeparatedList(environment.CORS_ORIGINS);
    if (origins.length === 0 || origins.some((origin) => !isSecureRemoteUrl(origin))) {
      context.addIssue({
        code: 'custom',
        message: 'CORS_ORIGINS must contain only explicit non-placeholder HTTPS origins.',
        path: ['CORS_ORIGINS'],
      });
    }

    for (const name of ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'] as const) {
      if (isPlaceholderValue(environment[name])) {
        context.addIssue({
          code: 'custom',
          message: `${name} must not contain a development placeholder.`,
          path: [name],
        });
      }
    }

    if (
      environment.TWILIO_API_KEY_SECRET !== undefined &&
      isPlaceholderValue(environment.TWILIO_API_KEY_SECRET)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'TWILIO_API_KEY_SECRET must not contain a development placeholder.',
        path: ['TWILIO_API_KEY_SECRET'],
      });
    }

    if (environment.AI_STYLIST_ENABLED === 'true') {
      if (
        environment.OPENAI_API_KEY === undefined ||
        isPlaceholderValue(environment.OPENAI_API_KEY)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'OPENAI_API_KEY is required when AI Stylist is enabled.',
          path: ['OPENAI_API_KEY'],
        });
      }
      if (environment.AI_STYLIST_DAILY_BUDGET_MICRO_USD === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'AI_STYLIST_DAILY_BUDGET_MICRO_USD is required outside local development.',
          path: ['AI_STYLIST_DAILY_BUDGET_MICRO_USD'],
        });
      }
    }

    if (
      environment.EXPO_PUSH_ENABLED === 'true' &&
      (environment.EXPO_PUSH_ACCESS_TOKEN === undefined ||
        isPlaceholderValue(environment.EXPO_PUSH_ACCESS_TOKEN))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'EXPO_PUSH_ACCESS_TOKEN is required when Expo push is enabled.',
        path: ['EXPO_PUSH_ACCESS_TOKEN'],
      });
    }
  });

export interface ApiConfig {
  readonly accountDeletionBatchSize: number;
  readonly accountDeletionEnabled: boolean;
  readonly accountDeletionMaxAttempts: number;
  readonly accountDeletionPollIntervalMs: number;
  readonly accountDeletionReauthMaxAgeSeconds: number;
  readonly accountDeletionStaleLockSeconds: number;
  readonly aiStylistCachedInputCostMicroUsdPerMillion: number;
  readonly aiStylistDailyBudgetMicroUsd?: number;
  readonly aiStylistDailyUserLimit: number;
  readonly aiStylistEnabled: boolean;
  readonly aiStylistInputCostMicroUsdPerMillion: number;
  readonly aiStylistMaxConcurrentGenerations: number;
  readonly aiStylistMaxInputCharacters: number;
  readonly aiStylistMaxOutfitOptions: number;
  readonly aiStylistMaxOutputTokens: number;
  readonly aiStylistMaxRequestsPerMinute: number;
  readonly aiStylistMaxToolCalls: number;
  readonly aiStylistModel: string;
  readonly aiStylistOutputCostMicroUsdPerMillion: number;
  readonly aiStylistReasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  readonly aiStylistSessionTurnLimit: number;
  readonly aiStylistTimeoutMs: number;
  readonly conversationMaxStartsPerDay: number;
  readonly codEnabled: boolean;
  readonly commercialApprovalReference?: string;
  readonly courierAgreementReference?: string;
  readonly corsOrigins: readonly string[];
  readonly databasePoolMax: number;
  readonly deploymentEnvironment: DeploymentEnvironment;
  readonly disputeEvidenceBucket: string;
  readonly disputeEvidenceRetentionDays?: number;
  readonly disputeEvidenceSignedUrlTtlSeconds: number;
  readonly disputeShippedMinAgeHours: number;
  readonly disputeWindowHours: number;
  readonly expoPushAccessToken?: string;
  readonly expoPushEnabled: boolean;
  readonly host: string;
  readonly logFormat: 'json' | 'pretty';
  readonly listingImageBucket: string;
  readonly listingImageSignedUrlTtlSeconds: number;
  readonly localCourierEnabled: boolean;
  readonly localCourierServiceCities: readonly string[];
  readonly localCourierServiceCountryCode: string;
  readonly lahoreDeliveryFeeMinor: number;
  readonly lahoreDeliveryRateVersion: string;
  readonly marketplaceCommissionBps: 1000;
  readonly messageMaxBlockedPerHour: number;
  readonly messageMaxSendsPerMinute: number;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly openAiApiKey?: string;
  readonly outboxBatchSize: number;
  readonly outboxMaxAttempts: number;
  readonly outboxPollIntervalMs: number;
  readonly phoneVerificationAttemptTtlSeconds: number;
  readonly phoneVerificationMaxChecks: number;
  readonly phoneVerificationMaxSends: number;
  readonly phoneVerificationMaxStarts: number;
  readonly phoneVerificationResendCooldownSeconds: number;
  readonly phoneVerificationStartWindowSeconds: number;
  readonly phoneAuthEnabled: boolean;
  readonly payfastEnabled: boolean;
  readonly payfastLiveEnabled: boolean;
  readonly payfastCheckoutUrl?: string;
  readonly payfastStatusUrl?: string;
  readonly payfastMerchantId?: string;
  readonly payfastSigningSecret?: string;
  readonly payfastMarketplaceApprovalReference?: string;
  readonly paymentExpiryMinutes: number;
  readonly payoutsEnabled: boolean;
  readonly payoutEncryptionKey?: string;
  readonly port: number;
  readonly privacyPolicyUrl?: string;
  readonly profileImageBucket: string;
  readonly pushReceiptDelaySeconds: number;
  readonly realtimeBroadcastEnabled: boolean;
  readonly registrationEnabled: boolean;
  readonly releaseVersion: string;
  readonly sellerVerificationMinCompletedSales: number;
  readonly sellerVerificationReapplyDays: number;
  readonly sellerVerificationEnabled: boolean;
  readonly sentryDsn?: string;
  readonly sentryTracesSampleRate: number;
  readonly supportUrl?: string;
  readonly supabasePublishableKey: string;
  readonly supabaseSecretKey: string;
  readonly supabaseUrl: string;
  readonly twilioAccountSid?: string;
  readonly twilioApiKeySecret?: string;
  readonly twilioApiKeySid?: string;
  readonly twilioVerifyServiceSid?: string;
  readonly termsOfUseUrl?: string;
  readonly communityGuidelinesUrl?: string;
  readonly accountDeletionUrl?: string;
  readonly withholdingBps: number;
  readonly withholdingRuleVersion: string;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = apiEnvironmentSchema.parse(environment);

  return Object.freeze({
    accountDeletionBatchSize: parsed.ACCOUNT_DELETION_BATCH_SIZE,
    accountDeletionEnabled: parsed.ACCOUNT_DELETION_ENABLED === 'true',
    accountDeletionMaxAttempts: parsed.ACCOUNT_DELETION_MAX_ATTEMPTS,
    accountDeletionPollIntervalMs: parsed.ACCOUNT_DELETION_POLL_INTERVAL_MS,
    accountDeletionReauthMaxAgeSeconds: parsed.ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
    accountDeletionStaleLockSeconds: parsed.ACCOUNT_DELETION_STALE_LOCK_SECONDS,
    aiStylistCachedInputCostMicroUsdPerMillion:
      parsed.AI_STYLIST_CACHED_INPUT_COST_MICRO_USD_PER_MILLION,
    ...(parsed.AI_STYLIST_DAILY_BUDGET_MICRO_USD === undefined
      ? {}
      : { aiStylistDailyBudgetMicroUsd: parsed.AI_STYLIST_DAILY_BUDGET_MICRO_USD }),
    aiStylistDailyUserLimit: parsed.AI_STYLIST_DAILY_USER_LIMIT,
    aiStylistEnabled: parsed.AI_STYLIST_ENABLED === 'true',
    aiStylistInputCostMicroUsdPerMillion: parsed.AI_STYLIST_INPUT_COST_MICRO_USD_PER_MILLION,
    aiStylistMaxConcurrentGenerations: parsed.AI_STYLIST_MAX_CONCURRENT_GENERATIONS,
    aiStylistMaxInputCharacters: parsed.AI_STYLIST_MAX_INPUT_CHARACTERS,
    aiStylistMaxOutfitOptions: parsed.AI_STYLIST_MAX_OUTFIT_OPTIONS,
    aiStylistMaxOutputTokens: parsed.AI_STYLIST_MAX_OUTPUT_TOKENS,
    aiStylistMaxRequestsPerMinute: parsed.AI_STYLIST_MAX_REQUESTS_PER_MINUTE,
    aiStylistMaxToolCalls: parsed.AI_STYLIST_MAX_TOOL_CALLS,
    aiStylistModel: parsed.AI_STYLIST_MODEL,
    aiStylistOutputCostMicroUsdPerMillion: parsed.AI_STYLIST_OUTPUT_COST_MICRO_USD_PER_MILLION,
    aiStylistReasoningEffort: parsed.AI_STYLIST_REASONING_EFFORT,
    aiStylistSessionTurnLimit: parsed.AI_STYLIST_SESSION_TURN_LIMIT,
    aiStylistTimeoutMs: parsed.AI_STYLIST_TIMEOUT_MS,
    conversationMaxStartsPerDay: parsed.CONVERSATION_MAX_STARTS_PER_DAY,
    codEnabled: parsed.COD_ENABLED === 'true',
    ...(parsed.COMMERCIAL_APPROVAL_REFERENCE === undefined
      ? {}
      : { commercialApprovalReference: parsed.COMMERCIAL_APPROVAL_REFERENCE }),
    ...(parsed.COURIER_AGREEMENT_REFERENCE === undefined
      ? {}
      : { courierAgreementReference: parsed.COURIER_AGREEMENT_REFERENCE }),
    corsOrigins: parseCommaSeparatedList(parsed.CORS_ORIGINS),
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    deploymentEnvironment: parsed.DEPLOYMENT_ENV,
    disputeEvidenceBucket: parsed.DISPUTE_EVIDENCE_BUCKET,
    ...(parsed.DISPUTE_EVIDENCE_RETENTION_DAYS === undefined
      ? {}
      : { disputeEvidenceRetentionDays: parsed.DISPUTE_EVIDENCE_RETENTION_DAYS }),
    disputeEvidenceSignedUrlTtlSeconds: parsed.DISPUTE_EVIDENCE_SIGNED_URL_TTL_SECONDS,
    disputeShippedMinAgeHours: parsed.DISPUTE_SHIPPED_MIN_AGE_HOURS,
    disputeWindowHours: parsed.DISPUTE_WINDOW_HOURS,
    ...(parsed.EXPO_PUSH_ACCESS_TOKEN === undefined
      ? {}
      : { expoPushAccessToken: parsed.EXPO_PUSH_ACCESS_TOKEN }),
    expoPushEnabled: parsed.EXPO_PUSH_ENABLED === 'true',
    host: parsed.API_HOST,
    logFormat: parsed.LOG_FORMAT,
    listingImageBucket: parsed.LISTING_IMAGE_BUCKET,
    listingImageSignedUrlTtlSeconds: parsed.LISTING_IMAGE_SIGNED_URL_TTL_SECONDS,
    localCourierEnabled: parsed.LOCAL_COURIER_ENABLED === 'true',
    localCourierServiceCities: parseCommaSeparatedList(parsed.LOCAL_COURIER_SERVICE_CITIES),
    localCourierServiceCountryCode: parsed.LOCAL_COURIER_SERVICE_COUNTRY_CODE,
    lahoreDeliveryFeeMinor: parsed.LAHORE_DELIVERY_FEE_MINOR,
    lahoreDeliveryRateVersion: parsed.LAHORE_DELIVERY_RATE_VERSION,
    marketplaceCommissionBps: parsed.MARKETPLACE_COMMISSION_BPS as 1000,
    messageMaxBlockedPerHour: parsed.MESSAGE_MAX_BLOCKED_PER_HOUR,
    messageMaxSendsPerMinute: parsed.MESSAGE_MAX_SENDS_PER_MINUTE,
    nodeEnv: parsed.NODE_ENV,
    ...(parsed.OPENAI_API_KEY === undefined ? {} : { openAiApiKey: parsed.OPENAI_API_KEY }),
    outboxBatchSize: parsed.OUTBOX_BATCH_SIZE,
    outboxMaxAttempts: parsed.OUTBOX_MAX_ATTEMPTS,
    outboxPollIntervalMs: parsed.OUTBOX_POLL_INTERVAL_MS,
    phoneVerificationAttemptTtlSeconds: parsed.PHONE_VERIFICATION_ATTEMPT_TTL_SECONDS,
    phoneVerificationMaxChecks: parsed.PHONE_VERIFICATION_MAX_CHECKS,
    phoneVerificationMaxSends: parsed.PHONE_VERIFICATION_MAX_SENDS,
    phoneVerificationMaxStarts: parsed.PHONE_VERIFICATION_MAX_STARTS,
    phoneVerificationResendCooldownSeconds: parsed.PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    phoneVerificationStartWindowSeconds: parsed.PHONE_VERIFICATION_START_WINDOW_SECONDS,
    phoneAuthEnabled: parsed.PHONE_AUTH_ENABLED === 'true',
    payfastEnabled: parsed.PAYFAST_ENABLED === 'true',
    payfastLiveEnabled: parsed.PAYFAST_LIVE_ENABLED === 'true',
    ...(parsed.PAYFAST_CHECKOUT_URL === undefined
      ? {}
      : { payfastCheckoutUrl: parsed.PAYFAST_CHECKOUT_URL }),
    ...(parsed.PAYFAST_STATUS_URL === undefined
      ? {}
      : { payfastStatusUrl: parsed.PAYFAST_STATUS_URL }),
    ...(parsed.PAYFAST_MERCHANT_ID === undefined
      ? {}
      : { payfastMerchantId: parsed.PAYFAST_MERCHANT_ID }),
    ...(parsed.PAYFAST_SIGNING_SECRET === undefined
      ? {}
      : { payfastSigningSecret: parsed.PAYFAST_SIGNING_SECRET }),
    ...(parsed.PAYFAST_MARKETPLACE_APPROVAL_REFERENCE === undefined
      ? {}
      : { payfastMarketplaceApprovalReference: parsed.PAYFAST_MARKETPLACE_APPROVAL_REFERENCE }),
    paymentExpiryMinutes: parsed.PAYMENT_EXPIRY_MINUTES,
    payoutsEnabled: parsed.PAYOUTS_ENABLED === 'true',
    ...(parsed.PAYOUT_ENCRYPTION_KEY === undefined
      ? {}
      : { payoutEncryptionKey: parsed.PAYOUT_ENCRYPTION_KEY }),
    port: parsed.PORT ?? parsed.API_PORT,
    ...(parsed.PRIVACY_POLICY_URL === undefined
      ? {}
      : { privacyPolicyUrl: parsed.PRIVACY_POLICY_URL.replace(/\/$/, '') }),
    profileImageBucket: parsed.PROFILE_IMAGE_BUCKET,
    pushReceiptDelaySeconds: parsed.PUSH_RECEIPT_DELAY_SECONDS,
    realtimeBroadcastEnabled: parsed.REALTIME_BROADCAST_ENABLED === 'true',
    registrationEnabled: parsed.REGISTRATION_ENABLED === 'true',
    releaseVersion: parsed.RELEASE_VERSION,
    sellerVerificationMinCompletedSales: parsed.SELLER_VERIFICATION_MIN_COMPLETED_SALES,
    sellerVerificationReapplyDays: parsed.SELLER_VERIFICATION_REAPPLY_DAYS,
    sellerVerificationEnabled: parsed.SELLER_VERIFICATION_ENABLED === 'true',
    ...(parsed.SENTRY_DSN === undefined ? {} : { sentryDsn: parsed.SENTRY_DSN }),
    sentryTracesSampleRate: parsed.SENTRY_TRACES_SAMPLE_RATE,
    ...(parsed.SUPPORT_URL === undefined ? {} : { supportUrl: parsed.SUPPORT_URL }),
    supabasePublishableKey: parsed.SUPABASE_PUBLISHABLE_KEY,
    supabaseSecretKey: parsed.SUPABASE_SECRET_KEY,
    supabaseUrl: parsed.SUPABASE_URL.replace(/\/$/, ''),
    ...(parsed.TWILIO_ACCOUNT_SID === undefined
      ? {}
      : { twilioAccountSid: parsed.TWILIO_ACCOUNT_SID }),
    ...(parsed.TWILIO_API_KEY_SECRET === undefined
      ? {}
      : { twilioApiKeySecret: parsed.TWILIO_API_KEY_SECRET }),
    ...(parsed.TWILIO_API_KEY_SID === undefined
      ? {}
      : { twilioApiKeySid: parsed.TWILIO_API_KEY_SID }),
    ...(parsed.TWILIO_VERIFY_SERVICE_SID === undefined
      ? {}
      : { twilioVerifyServiceSid: parsed.TWILIO_VERIFY_SERVICE_SID }),
    ...(parsed.TERMS_OF_USE_URL === undefined
      ? {}
      : { termsOfUseUrl: parsed.TERMS_OF_USE_URL.replace(/\/$/, '') }),
    ...(parsed.COMMUNITY_GUIDELINES_URL === undefined
      ? {}
      : { communityGuidelinesUrl: parsed.COMMUNITY_GUIDELINES_URL.replace(/\/$/, '') }),
    ...(parsed.ACCOUNT_DELETION_URL === undefined
      ? {}
      : { accountDeletionUrl: parsed.ACCOUNT_DELETION_URL.replace(/\/$/, '') }),
    withholdingBps: parsed.WITHHOLDING_BPS,
    withholdingRuleVersion: parsed.WITHHOLDING_RULE_VERSION,
  });
}
