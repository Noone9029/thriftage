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
      accountDeletionBatchSize: 10,
      accountDeletionEnabled: false,
      accountDeletionMaxAttempts: 10,
      accountDeletionPollIntervalMs: 5000,
      accountDeletionReauthMaxAgeSeconds: 600,
      accountDeletionStaleLockSeconds: 300,
      aiStylistCachedInputCostMicroUsdPerMillion: 200_000,
      aiStylistDailyUserLimit: 20,
      aiStylistEnabled: false,
      aiStylistInputCostMicroUsdPerMillion: 2_000_000,
      aiStylistMaxConcurrentGenerations: 50,
      aiStylistMaxInputCharacters: 2000,
      aiStylistMaxOutfitOptions: 3,
      aiStylistMaxOutputTokens: 1800,
      aiStylistMaxRequestsPerMinute: 4,
      aiStylistMaxToolCalls: 6,
      aiStylistModel: 'gpt-5.6-terra',
      aiStylistOutputCostMicroUsdPerMillion: 12_000_000,
      aiStylistReasoningEffort: 'medium',
      aiStylistSessionTurnLimit: 40,
      aiStylistTimeoutMs: 20_000,
      conversationMaxStartsPerDay: 25,
      corsOrigins: [],
      deploymentEnvironment: 'local',
      disputeEvidenceBucket: 'dispute-evidence',
      disputeEvidenceSignedUrlTtlSeconds: 600,
      disputeShippedMinAgeHours: 72,
      disputeWindowHours: 336,
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
      phoneAuthEnabled: true,
      port: 4000,
      profileImageBucket: 'profile-images',
      pushReceiptDelaySeconds: 900,
      realtimeBroadcastEnabled: false,
      registrationEnabled: true,
      releaseVersion: 'development',
      sellerVerificationEnabled: false,
      sellerVerificationMinCompletedSales: 0,
      sellerVerificationReapplyDays: 30,
      sentryTracesSampleRate: 0,
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
      }),
    ).toMatchObject({
      corsOrigins: ['https://admin.example.com', 'https://app.example.com'],
      logFormat: 'json',
      nodeEnv: 'development',
      port: 4100,
    });
  });

  it('uses the hosting platform port when provided', () => {
    expect(
      loadApiConfig({
        ...requiredAuthEnvironment,
        API_PORT: '4100',
        PORT: '8080',
      }),
    ).toMatchObject({ port: 8080 });
  });

  it('requires explicit non-placeholder production configuration', () => {
    const deployedEnvironment = {
      ...requiredAuthEnvironment,
      ACCOUNT_DELETION_URL: 'https://privacy.thriftage.test/delete-account',
      COMMUNITY_GUIDELINES_URL: 'https://legal.thriftage.test/community',
      CORS_ORIGINS: 'https://admin.thriftage.test',
      DEPLOYMENT_ENV: 'staging',
      LOG_FORMAT: 'json',
      NODE_ENV: 'production',
      PRIVACY_POLICY_URL: 'https://legal.thriftage.test/privacy',
      RELEASE_VERSION: 'git-abc1234',
      SENTRY_DSN: 'https://public-key@o1.ingest.sentry.io/1',
      SUPPORT_URL: 'https://support.thriftage.test',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stagingvalue',
      SUPABASE_SECRET_KEY: 'sb_secret_stagingvalue',
      TERMS_OF_USE_URL: 'https://legal.thriftage.test/terms',
      TWILIO_API_KEY_SECRET: 'restricted-staging-key-value',
    };

    expect(loadApiConfig(deployedEnvironment)).toMatchObject({
      deploymentEnvironment: 'staging',
      nodeEnv: 'production',
      releaseVersion: 'git-abc1234',
    });
    expect(() =>
      loadApiConfig({ ...deployedEnvironment, SUPABASE_SECRET_KEY: 'sb_secret_placeholder' }),
    ).toThrow();
    expect(() => loadApiConfig({ ...requiredAuthEnvironment, NODE_ENV: 'production' })).toThrow();
  });

  it('allows unavailable staging providers to remain disabled without fake credentials', () => {
    const stagingEnvironment = {
      CORS_ORIGINS: 'https://admin-staging.thriftage.test',
      DEPLOYMENT_ENV: 'staging',
      LOG_FORMAT: 'json',
      NODE_ENV: 'production',
      PHONE_AUTH_ENABLED: 'false',
      RELEASE_VERSION: 'git-abc1234',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stagingvalue',
      SUPABASE_SECRET_KEY: 'sb_secret_stagingvalue',
      SUPABASE_URL: 'https://staging-project.supabase.co',
    };

    expect(loadApiConfig(stagingEnvironment)).toMatchObject({
      deploymentEnvironment: 'staging',
      phoneAuthEnabled: false,
    });
    expect(loadApiConfig(stagingEnvironment)).not.toHaveProperty('sentryDsn');
    expect(loadApiConfig(stagingEnvironment)).not.toHaveProperty('twilioApiKeySecret');
    expect(() =>
      loadApiConfig({ ...stagingEnvironment, SUPPORT_URL: 'http://support.thriftage.test' }),
    ).toThrow();
    expect(() => loadApiConfig({ ...stagingEnvironment, DEPLOYMENT_ENV: 'production' })).toThrow();
  });

  it('requires Twilio credentials only while phone authentication is enabled', () => {
    expect(() =>
      loadApiConfig({
        PHONE_AUTH_ENABLED: 'true',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-placeholder',
        SUPABASE_SECRET_KEY: 'sb_secret_test-placeholder',
        SUPABASE_URL: 'https://project-ref.supabase.co',
      }),
    ).toThrow();
  });

  it('validates backend-only AI controls without requiring a provider key while disabled', () => {
    expect(
      loadApiConfig({
        ...requiredAuthEnvironment,
        AI_STYLIST_DAILY_BUDGET_MICRO_USD: '250000',
        AI_STYLIST_ENABLED: 'true',
        AI_STYLIST_REASONING_EFFORT: 'high',
        OPENAI_API_KEY: 'sk-test-placeholder-not-a-real-key',
      }),
    ).toMatchObject({
      aiStylistDailyBudgetMicroUsd: 250_000,
      aiStylistEnabled: true,
      aiStylistReasoningEffort: 'high',
      openAiApiKey: 'sk-test-placeholder-not-a-real-key',
    });
    expect(() =>
      loadApiConfig({ ...requiredAuthEnvironment, AI_STYLIST_MAX_TOOL_CALLS: '0' }),
    ).toThrow();
    expect(() =>
      loadApiConfig({ ...requiredAuthEnvironment, AI_STYLIST_MAX_OUTFIT_OPTIONS: '4' }),
    ).toThrow();
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
