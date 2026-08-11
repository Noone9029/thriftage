import { describe, expect, it } from 'vitest';

import { loadApiConfig } from './api-environment';

describe('loadApiConfig', () => {
  const requiredAuthEnvironment = {
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-placeholder',
    SUPABASE_URL: 'https://project-ref.supabase.co',
  };

  it('returns safe local defaults', () => {
    expect(loadApiConfig(requiredAuthEnvironment)).toEqual({
      corsOrigins: [],
      host: '0.0.0.0',
      logFormat: 'pretty',
      nodeEnv: 'development',
      port: 4000,
      supabasePublishableKey: 'sb_publishable_test-placeholder',
      supabaseUrl: 'https://project-ref.supabase.co',
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
        SUPABASE_URL: 'https://project-ref.supabase.co',
      }),
    ).toThrow();
  });
});
