import { parseCommaSeparatedList } from '@thriftage/shared';
import { z } from 'zod';

const apiEnvironmentSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CONVERSATION_MAX_STARTS_PER_DAY: z.coerce.number().int().min(1).max(100).default(25),
  CORS_ORIGINS: z.string().optional(),
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
  MESSAGE_MAX_BLOCKED_PER_HOUR: z.coerce.number().int().min(1).max(100).default(10),
  MESSAGE_MAX_SENDS_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(25).default(10),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(1000),
  PHONE_VERIFICATION_ATTEMPT_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(600),
  PHONE_VERIFICATION_MAX_CHECKS: z.coerce.number().int().min(1).max(10).default(5),
  PHONE_VERIFICATION_MAX_SENDS: z.coerce.number().int().min(1).max(10).default(5),
  PHONE_VERIFICATION_MAX_STARTS: z.coerce.number().int().min(1).max(20).default(5),
  PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(30).max(600).default(60),
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
  PUSH_RECEIPT_DELAY_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REALTIME_BROADCAST_ENABLED: z.enum(['true', 'false']).default('false'),
  SELLER_VERIFICATION_MIN_COMPLETED_SALES: z.coerce.number().int().min(0).max(1000).default(0),
  SELLER_VERIFICATION_REAPPLY_DAYS: z.coerce.number().int().min(1).max(365).default(30),
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
    .regex(/^AC[A-Za-z0-9]{32}$/),
  TWILIO_API_KEY_SECRET: z.string().trim().min(16),
  TWILIO_API_KEY_SID: z
    .string()
    .trim()
    .regex(/^SK[A-Za-z0-9]{32}$/),
  TWILIO_VERIFY_SERVICE_SID: z
    .string()
    .trim()
    .regex(/^VA[A-Za-z0-9]{32}$/),
});

export interface ApiConfig {
  readonly conversationMaxStartsPerDay: number;
  readonly corsOrigins: readonly string[];
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
  readonly messageMaxBlockedPerHour: number;
  readonly messageMaxSendsPerMinute: number;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly outboxBatchSize: number;
  readonly outboxMaxAttempts: number;
  readonly outboxPollIntervalMs: number;
  readonly phoneVerificationAttemptTtlSeconds: number;
  readonly phoneVerificationMaxChecks: number;
  readonly phoneVerificationMaxSends: number;
  readonly phoneVerificationMaxStarts: number;
  readonly phoneVerificationResendCooldownSeconds: number;
  readonly phoneVerificationStartWindowSeconds: number;
  readonly port: number;
  readonly profileImageBucket: string;
  readonly pushReceiptDelaySeconds: number;
  readonly realtimeBroadcastEnabled: boolean;
  readonly sellerVerificationMinCompletedSales: number;
  readonly sellerVerificationReapplyDays: number;
  readonly supportUrl?: string;
  readonly supabasePublishableKey: string;
  readonly supabaseSecretKey: string;
  readonly supabaseUrl: string;
  readonly twilioAccountSid: string;
  readonly twilioApiKeySecret: string;
  readonly twilioApiKeySid: string;
  readonly twilioVerifyServiceSid: string;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = apiEnvironmentSchema.parse(environment);

  return Object.freeze({
    conversationMaxStartsPerDay: parsed.CONVERSATION_MAX_STARTS_PER_DAY,
    corsOrigins: parseCommaSeparatedList(parsed.CORS_ORIGINS),
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
    messageMaxBlockedPerHour: parsed.MESSAGE_MAX_BLOCKED_PER_HOUR,
    messageMaxSendsPerMinute: parsed.MESSAGE_MAX_SENDS_PER_MINUTE,
    nodeEnv: parsed.NODE_ENV,
    outboxBatchSize: parsed.OUTBOX_BATCH_SIZE,
    outboxMaxAttempts: parsed.OUTBOX_MAX_ATTEMPTS,
    outboxPollIntervalMs: parsed.OUTBOX_POLL_INTERVAL_MS,
    phoneVerificationAttemptTtlSeconds: parsed.PHONE_VERIFICATION_ATTEMPT_TTL_SECONDS,
    phoneVerificationMaxChecks: parsed.PHONE_VERIFICATION_MAX_CHECKS,
    phoneVerificationMaxSends: parsed.PHONE_VERIFICATION_MAX_SENDS,
    phoneVerificationMaxStarts: parsed.PHONE_VERIFICATION_MAX_STARTS,
    phoneVerificationResendCooldownSeconds: parsed.PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    phoneVerificationStartWindowSeconds: parsed.PHONE_VERIFICATION_START_WINDOW_SECONDS,
    port: parsed.API_PORT,
    profileImageBucket: parsed.PROFILE_IMAGE_BUCKET,
    pushReceiptDelaySeconds: parsed.PUSH_RECEIPT_DELAY_SECONDS,
    realtimeBroadcastEnabled: parsed.REALTIME_BROADCAST_ENABLED === 'true',
    sellerVerificationMinCompletedSales: parsed.SELLER_VERIFICATION_MIN_COMPLETED_SALES,
    sellerVerificationReapplyDays: parsed.SELLER_VERIFICATION_REAPPLY_DAYS,
    ...(parsed.SUPPORT_URL === undefined ? {} : { supportUrl: parsed.SUPPORT_URL }),
    supabasePublishableKey: parsed.SUPABASE_PUBLISHABLE_KEY,
    supabaseSecretKey: parsed.SUPABASE_SECRET_KEY,
    supabaseUrl: parsed.SUPABASE_URL.replace(/\/$/, ''),
    twilioAccountSid: parsed.TWILIO_ACCOUNT_SID,
    twilioApiKeySecret: parsed.TWILIO_API_KEY_SECRET,
    twilioApiKeySid: parsed.TWILIO_API_KEY_SID,
    twilioVerifyServiceSid: parsed.TWILIO_VERIFY_SERVICE_SID,
  });
}
