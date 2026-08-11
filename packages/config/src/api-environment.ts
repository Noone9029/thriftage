import { parseCommaSeparatedList } from '@thriftage/shared';
import { z } from 'zod';

const apiEnvironmentSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: z.string().optional(),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
  LISTING_IMAGE_BUCKET: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
    .default('listing-images'),
  LISTING_IMAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
  readonly corsOrigins: readonly string[];
  readonly host: string;
  readonly logFormat: 'json' | 'pretty';
  readonly listingImageBucket: string;
  readonly listingImageSignedUrlTtlSeconds: number;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly phoneVerificationAttemptTtlSeconds: number;
  readonly phoneVerificationMaxChecks: number;
  readonly phoneVerificationMaxSends: number;
  readonly phoneVerificationMaxStarts: number;
  readonly phoneVerificationResendCooldownSeconds: number;
  readonly phoneVerificationStartWindowSeconds: number;
  readonly port: number;
  readonly profileImageBucket: string;
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
    corsOrigins: parseCommaSeparatedList(parsed.CORS_ORIGINS),
    host: parsed.API_HOST,
    logFormat: parsed.LOG_FORMAT,
    listingImageBucket: parsed.LISTING_IMAGE_BUCKET,
    listingImageSignedUrlTtlSeconds: parsed.LISTING_IMAGE_SIGNED_URL_TTL_SECONDS,
    nodeEnv: parsed.NODE_ENV,
    phoneVerificationAttemptTtlSeconds: parsed.PHONE_VERIFICATION_ATTEMPT_TTL_SECONDS,
    phoneVerificationMaxChecks: parsed.PHONE_VERIFICATION_MAX_CHECKS,
    phoneVerificationMaxSends: parsed.PHONE_VERIFICATION_MAX_SENDS,
    phoneVerificationMaxStarts: parsed.PHONE_VERIFICATION_MAX_STARTS,
    phoneVerificationResendCooldownSeconds: parsed.PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    phoneVerificationStartWindowSeconds: parsed.PHONE_VERIFICATION_START_WINDOW_SECONDS,
    port: parsed.API_PORT,
    profileImageBucket: parsed.PROFILE_IMAGE_BUCKET,
    supabasePublishableKey: parsed.SUPABASE_PUBLISHABLE_KEY,
    supabaseSecretKey: parsed.SUPABASE_SECRET_KEY,
    supabaseUrl: parsed.SUPABASE_URL.replace(/\/$/, ''),
    twilioAccountSid: parsed.TWILIO_ACCOUNT_SID,
    twilioApiKeySecret: parsed.TWILIO_API_KEY_SECRET,
    twilioApiKeySid: parsed.TWILIO_API_KEY_SID,
    twilioVerifyServiceSid: parsed.TWILIO_VERIFY_SERVICE_SID,
  });
}
