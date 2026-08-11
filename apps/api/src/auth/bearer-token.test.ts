import { describe, expect, it } from 'vitest';

import { AuthApiException } from './auth.errors';
import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it('extracts a valid bearer token case-insensitively', () => {
    expect(extractBearerToken('Bearer access-token')).toBe('access-token');
    expect(extractBearerToken('bearer access-token')).toBe('access-token');
  });

  it.each([
    ['missing header', undefined],
    ['multiple headers', ['Bearer one', 'Bearer two']],
    ['malformed header', 'Bearer token extra'],
    ['wrong scheme', 'Basic credentials'],
    ['blank token', 'Bearer   '],
  ])('rejects %s', (_caseName, header) => {
    expect(() => extractBearerToken(header)).toThrowError(AuthApiException);
    try {
      extractBearerToken(header);
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: 'AUTH_REQUIRED' });
    }
  });
});
