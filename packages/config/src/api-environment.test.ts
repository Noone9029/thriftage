import { describe, expect, it } from 'vitest';

import { loadApiConfig } from './api-environment';

describe('loadApiConfig', () => {
  it('returns safe local defaults', () => {
    expect(loadApiConfig({})).toEqual({
      corsOrigins: [],
      host: '0.0.0.0',
      logFormat: 'pretty',
      nodeEnv: 'development',
      port: 4000,
    });
  });

  it('normalizes configured origins and numeric ports', () => {
    expect(
      loadApiConfig({
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
    expect(() => loadApiConfig({ API_PORT: '70000' })).toThrow();
  });
});
