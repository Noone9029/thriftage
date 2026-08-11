import { describe, expect, it, vi } from 'vitest';

import { TwilioVerifyAdapter } from './twilio-verify.adapter';

describe('TwilioVerifyAdapter', () => {
  it('maps a successful SMS challenge to an application-owned result', async () => {
    const client = {
      checkVerification: vi.fn(),
      sendVerification: vi.fn().mockResolvedValue({ sid: 'VE-safe-reference', status: 'pending' }),
    };
    const adapter = new TwilioVerifyAdapter(client);

    await expect(adapter.sendVerification('+923001234567')).resolves.toEqual({
      providerReference: 'VE-safe-reference',
      status: 'PENDING',
    });
    expect(client.sendVerification).toHaveBeenCalledWith('+923001234567');
  });

  it.each([
    ['approved', 'APPROVED'],
    ['pending', 'INVALID'],
    ['expired', 'EXPIRED'],
    ['canceled', 'EXPIRED'],
    ['max_attempts_reached', 'EXPIRED'],
  ] as const)('maps provider check status %s to %s', async (providerStatus, expected) => {
    const client = {
      checkVerification: vi.fn().mockResolvedValue({ status: providerStatus }),
      sendVerification: vi.fn(),
    };
    const adapter = new TwilioVerifyAdapter(client);

    await expect(adapter.verifyCode('+923001234567', '012345')).resolves.toEqual({
      status: expected,
    });
  });

  it.each([
    [{ code: 60203 }, 'RATE_LIMITED'],
    [{ status: 429 }, 'RATE_LIMITED'],
    [{ code: 60623 }, 'EXPIRED'],
    [new Error('provider unavailable'), 'PROVIDER_ERROR'],
  ] as const)('maps provider exception safely', async (providerError, expectedCode) => {
    const client = {
      checkVerification: vi.fn().mockRejectedValue(providerError),
      sendVerification: vi.fn(),
    };
    const adapter = new TwilioVerifyAdapter(client);

    await expect(adapter.verifyCode('+923001234567', '012345')).rejects.toMatchObject({
      code: expectedCode,
      message: 'Phone verification provider request failed.',
    });
  });

  it('maps send failures without exposing Twilio details', async () => {
    const client = {
      checkVerification: vi.fn(),
      sendVerification: vi.fn().mockRejectedValue({ code: 60203, detail: 'private' }),
    };

    await expect(
      new TwilioVerifyAdapter(client).sendVerification('+923001234567'),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Phone verification provider request failed.',
    });
  });
});
