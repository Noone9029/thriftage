import { describe, expect, it } from 'vitest';

import { DEMO_CONFIRMATION, DEMO_PROJECT_REF } from './demo-marketplace.manifest';
import { assertDemoSeedTarget } from './demo-safety';

describe('demo marketplace environment guard', () => {
  it('accepts the exact staging target and confirmation', () => {
    expect(
      assertDemoSeedTarget({
        ALLOW_DEMO_MARKETPLACE_SEED: DEMO_CONFIRMATION,
        DEMO_SUPABASE_PROJECT_REF: DEMO_PROJECT_REF,
        DEPLOYMENT_ENV: 'staging',
        SUPABASE_URL: `https://${DEMO_PROJECT_REF}.supabase.co`,
      }),
    ).toEqual({ deploymentEnvironment: 'staging', projectRef: DEMO_PROJECT_REF });
  });

  it.each([
    [{}, 'explicit local or staging'],
    [{ DEPLOYMENT_ENV: 'production' }, 'explicit local or staging'],
    [
      { DEPLOYMENT_ENV: 'staging', SUPABASE_URL: `https://${DEMO_PROJECT_REF}.supabase.co` },
      'confirmation',
    ],
    [
      {
        ALLOW_DEMO_MARKETPLACE_SEED: DEMO_CONFIRMATION,
        DEPLOYMENT_ENV: 'staging',
        DEMO_SUPABASE_PROJECT_REF: DEMO_PROJECT_REF,
        SUPABASE_URL: 'https://wrong.supabase.co',
      },
      'project identity',
    ],
    [
      {
        ALLOW_DEMO_MARKETPLACE_SEED: DEMO_CONFIRMATION,
        DEPLOYMENT_ENV: 'local',
        SUPABASE_URL: 'https://example.com',
      },
      'loopback',
    ],
  ])('rejects an unsafe target', (environment, message) => {
    expect(() => assertDemoSeedTarget(environment)).toThrow(message);
  });
});
