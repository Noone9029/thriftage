import { describe, expect, it } from 'vitest';

import { parseMarketingEnvironment } from './marketing-environment';

describe('marketing environment', () => {
  it('validates required values without rejecting unrelated platform variables', () => {
    const result = parseMarketingEnvironment({
      DATABASE_URL: 'postgresql://runtime@example.test:5432/thriftage',
      MARKETING_FORM_HASH_SECRET: 's'.repeat(32),
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      DATABASE_URL: 'postgresql://runtime@example.test:5432/thriftage',
      MARKETING_FORM_HASH_SECRET: 's'.repeat(32),
    });
  });

  it('reports missing required values by key', () => {
    const result = parseMarketingEnvironment({ VERCEL: '1' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toEqual([
      'DATABASE_URL',
      'MARKETING_FORM_HASH_SECRET',
    ]);
  });
});
