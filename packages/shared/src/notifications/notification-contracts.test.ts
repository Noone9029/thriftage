import { describe, expect, it } from 'vitest';

import { pushDeviceInputSchema } from './notification-contracts';

describe('notification contracts', () => {
  it('accepts a synthetic Expo push token', () => {
    expect(
      pushDeviceInputSchema.parse({
        expoPushToken: 'ExpoPushToken[Synthetic_123]',
        platform: 'ANDROID',
      }),
    ).toMatchObject({ platform: 'ANDROID' });
  });
  it('rejects malformed device tokens', () => {
    expect(() =>
      pushDeviceInputSchema.parse({ expoPushToken: 'not-a-push-token', platform: 'IOS' }),
    ).toThrow();
  });
});
