import { describe, expect, it } from 'vitest';

import { matchesExactHttpsHost } from './load-target-guard.js';

describe('matchesExactHttpsHost', () => {
  it('accepts only the exact HTTPS host with a path', () => {
    expect(
      matchesExactHttpsHost('https://api-staging.example.test/api/v1', 'api-staging.example.test'),
    ).toBe(true);
    expect(
      matchesExactHttpsHost('https://api-staging.example.test/api/v1/', 'api-staging.example.test'),
    ).toBe(true);
  });

  it.each([
    ['http://api-staging.example.test/api/v1', 'api-staging.example.test'],
    ['https://api-staging.example.test.evil.test/api/v1', 'api-staging.example.test'],
    ['https://user@api-staging.example.test/api/v1', 'api-staging.example.test'],
    ['https://api-staging.example.test/api/v1?target=other', 'api-staging.example.test'],
    ['https://api-staging.example.test/api/v1', 'other-staging.example.test'],
    ['', 'api-staging.example.test'],
    ['https://api-staging.example.test/api/v1', ''],
  ])('rejects unsafe or mismatched target %s', (baseUrl, expectedHost) => {
    expect(matchesExactHttpsHost(baseUrl, expectedHost)).toBe(false);
  });
});
