import { describe, expect, it } from 'vitest';

import { loadApiConfig } from './api-environment';

describe('loadApiConfig', () => {
  const requiredAuthEnvironment = {
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-placeholder',
    SUPABASE_SECRET_KEY: 'sb_secret_test-placeholder',
    SUPABASE_URL: 'https://project-ref.supabase.co',
    TWILIO_ACCOUNT_SID: `AC${'1'.repeat(32)}`,
    TWILIO_API_KEY_SECRET: 'test-api-key-secret-placeholder',
    TWILIO_API_KEY_SID: `SK${'2'.repeat(32)}`,
    TWILIO_VERIFY_SERVICE_SID: `VA${'3'.repeat(32)}`,
  };

  it('returns safe local defaults', () => {
    expect(loadApiConfig(requiredAuthEnvironment)).toEqual({
      conversationMaxStartsPerDay: 25,
      corsOrigins: [],
      expoPushEnabled: false,
      host: '0.0.0.0',
      logFormat: 'pretty',
      listingImageBucket: 'listing-images',
      listingImageSignedUrlTtlSeconds: 900,
      messageMaxBlockedPerHour: 10,
      messageMaxSendsPerMinute: 20,
      nodeEnv: 'development',
      outboxBatchSize: 25,
      outboxMaxAttempts: 10,
      outboxPollIntervalMs: 1000,
      phoneVerificationAttemptTtlSeconds: 600,
      phoneVerificationMaxChecks: 5,
      phoneVerificationMaxSends: 5,
      phoneVerificationMaxStarts: 5,
      phoneVerificationResendCooldownSeconds: 60,
      phoneVerificationStartWindowSeconds: 3600,
      port: 4000,
      profileImageBucket: 'profile-images',
      pushReceiptDelaySeconds: 900,
      realtimeBroadcastEnabled: false,
      supabasePublishableKey: 'sb_publishable_test-placeholder',
      supabaseSecretKey: 'sb_secret_test-placeholder',
      supabaseUrl: 'https://project-ref.supabase.co',
      twilioAccountSid: `AC${'1'.repeat(32)}`,
      twilioApiKeySecret: 'test-api-key-secret-placeholder',
      twilioApiKeySid: `SK${'2'.repeat(32)}`,
      twilioVerifyServiceSid: `VA${'3'.repeat(32)}`,
    });
  });

  it('normalizes configured origins and numeric ports', () => {
    expect(
      loadApiConfig({
        ...requiredAuthEnvironment,
        API_PORT: '4100',
        CORS_ORIGINS: 'https://admin.example.com, https://app.example.com',
        LOG_FORMAT: 'json',
        NODE_ENV: 'production',
      }),
    ).toMatchObject({
      corsOrigins: ['https://admin.example.com', 'https://app.example.com'],
      logFormat: 'json',
      nodeEnv: 'production',
      port: 4100,
    });
  });

  it('rejects invalid ports', () => {
    expect(() => loadApiConfig({ ...requiredAuthEnvironment, API_PORT: '70000' })).toThrow();
  });

  it('requires project auth configuration and rejects secret keys', () => {
    expect(() => loadApiConfig({})).toThrow();
    expect(() =>
      loadApiConfig({
        SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do-not-use',
        SUPABASE_SECRET_KEY: 'sb_secret_test-placeholder',
        SUPABASE_URL: 'https://project-ref.supabase.co',
        TWILIO_ACCOUNT_SID: `AC${'1'.repeat(32)}`,
        TWILIO_API_KEY_SECRET: 'test-api-key-secret-placeholder',
        TWILIO_API_KEY_SID: `SK${'2'.repeat(32)}`,
        TWILIO_VERIFY_SERVICE_SID: `VA${'3'.repeat(32)}`,
      }),
    ).toThrow();
  });

  it('requires modern backend-only Supabase and Twilio credentials', () => {
    expect(() =>
      loadApiConfig({ ...requiredAuthEnvironment, SUPABASE_SECRET_KEY: 'legacy-service-role' }),
    ).toThrow();
    expect(() =>
      loadApiConfig({ ...requiredAuthEnvironment, TWILIO_API_KEY_SID: 'invalid' }),
    ).toThrow();
  });
});
