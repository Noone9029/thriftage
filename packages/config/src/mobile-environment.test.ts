import { describe, expect, it } from 'vitest';

import { loadMobileConfig } from './mobile-environment';

const validEnvironment = {
  apiUrl: 'https://api.example.com/api/v1/',
  supportUrl: 'https://support.example.com/',
  supabasePublishableKey: 'sb_publishable_mobile-placeholder',
  supabaseUrl: 'https://project-ref.supabase.co/',
};

describe('loadMobileConfig', () => {
  it('normalizes public mobile URLs', () => {
    expect(loadMobileConfig(validEnvironment)).toEqual({
      apiUrl: 'https://api.example.com/api/v1',
      appScheme: 'thriftage',
      deploymentEnvironment: 'local',
      releaseVersion: 'development',
      sentryTracesSampleRate: 0,
      supportUrl: 'https://support.example.com',
      supabasePublishableKey: 'sb_publishable_mobile-placeholder',
      supabaseUrl: 'https://project-ref.supabase.co',
    });
  });

  it('fails clearly when required public configuration is missing', () => {
    expect(() =>
      loadMobileConfig({
        apiUrl: undefined,
        appScheme: undefined,
        deploymentEnvironment: undefined,
        releaseVersion: undefined,
        supportUrl: undefined,
        supabasePublishableKey: undefined,
        supabaseUrl: undefined,
      }),
    ).toThrow();
  });

  it('rejects local and placeholder services for deployed builds', () => {
    const deployed = {
      accountDeletionUrl: 'https://privacy.thriftage.test/delete-account',
      apiUrl: 'https://api.thriftage.test/api/v1',
      communityGuidelinesUrl: 'https://legal.thriftage.test/community',
      deploymentEnvironment: 'staging',
      privacyPolicyUrl: 'https://legal.thriftage.test/privacy',
      releaseVersion: '0.1.0-preview.12',
      sentryDsn: 'https://public-key@o1.ingest.sentry.io/1',
      supportUrl: 'https://support.thriftage.test',
      supabasePublishableKey: 'sb_publishable_stagingvalue',
      supabaseUrl: 'https://staging-ref.supabase.co',
      termsOfUseUrl: 'https://legal.thriftage.test/terms',
    };

    expect(loadMobileConfig(deployed)).toMatchObject({
      deploymentEnvironment: 'staging',
      releaseVersion: '0.1.0-preview.12',
    });
    expect(() => loadMobileConfig({ ...deployed, apiUrl: 'http://localhost:4000' })).toThrow();
    expect(() =>
      loadMobileConfig({ ...deployed, supabasePublishableKey: 'sb_publishable_placeholder' }),
    ).toThrow();
  });

  it('allows unavailable legal, support, and monitoring providers to remain blocked in staging', () => {
    expect(
      loadMobileConfig({
        apiUrl: 'https://api-staging.thriftage.test/api/v1',
        deploymentEnvironment: 'staging',
        releaseVersion: 'staging-sha',
        supabasePublishableKey: 'sb_publishable_stagingvalue',
        supabaseUrl: 'https://staging-ref.supabase.co',
      }),
    ).toMatchObject({
      deploymentEnvironment: 'staging',
      releaseVersion: 'staging-sha',
    });
  });

  it('requires legal, support, and monitoring URLs in production', () => {
    expect(() =>
      loadMobileConfig({
        apiUrl: 'https://api.thriftage.test/api/v1',
        deploymentEnvironment: 'production',
        releaseVersion: 'production-sha',
        supabasePublishableKey: 'sb_publishable_productionvalue',
        supabaseUrl: 'https://production-ref.supabase.co',
      }),
    ).toThrow();
  });

  it('rejects Supabase secret keys', () => {
    expect(() =>
      loadMobileConfig({ ...validEnvironment, supabasePublishableKey: 'sb_secret_forbidden' }),
    ).toThrow();
  });
});
