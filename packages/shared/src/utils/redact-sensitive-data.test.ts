import { describe, expect, it } from 'vitest';

import { redactSensitiveData } from './redact-sensitive-data';

describe('redactSensitiveData', () => {
  it('removes private fields recursively while retaining operational context', () => {
    expect(
      redactSensitiveData({
        context: { messageBody: 'private chat', route: '/api/v1/orders' },
        email: 'person@example.test',
        requestId: 'request-123',
      }),
    ).toEqual({
      context: { messageBody: '[Filtered]', route: '/api/v1/orders' },
      email: '[Filtered]',
      requestId: 'request-123',
    });
  });

  it('redacts bearer credentials and JWT-shaped values in otherwise safe strings', () => {
    expect(redactSensitiveData('Bearer abc.def-123 and eyJone.eyJtwo.signature')).toBe(
      'Bearer [Filtered] and [Filtered JWT]',
    );
  });
});
