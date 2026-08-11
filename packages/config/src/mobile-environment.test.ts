import { describe, expect, it } from 'vitest';

import { loadMobileConfig } from './mobile-environment';

const validEnvironment = {
  apiUrl: 'https://api.example.com/api/v1/',
  supabasePublishableKey: 'sb_publishable_mobile-placeholder',
  supabaseUrl: 'https://project-ref.supabase.co/',
};

describe('loadMobileConfig', () => {
  it('normalizes public mobile URLs', () => {
    expect(loadMobileConfig(validEnvironment)).toEqual({
      apiUrl: 'https://api.example.com/api/v1',
      supabasePublishableKey: 'sb_publishable_mobile-placeholder',
      supabaseUrl: 'https://project-ref.supabase.co',
    });
  });

  it('fails clearly when required public configuration is missing', () => {
    expect(() =>
      loadMobileConfig({
        apiUrl: undefined,
        supabasePublishableKey: undefined,
        supabaseUrl: undefined,
      }),
    ).toThrow();
  });

  it('rejects Supabase secret keys', () => {
    expect(() =>
      loadMobileConfig({ ...validEnvironment, supabasePublishableKey: 'sb_secret_forbidden' }),
    ).toThrow();
  });
});
