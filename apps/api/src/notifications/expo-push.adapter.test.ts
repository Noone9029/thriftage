import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExpoPushAdapter } from './expo-push.adapter';

describe('ExpoPushAdapter', () => {
  afterEach(() => {
    delete process.env.EXPO_PUSH_ENABLED;
    vi.unstubAllGlobals();
  });
  it('never calls Expo when push is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ExpoPushAdapter();
    await expect(
      adapter.send({ body: 'Body', data: {}, title: 'Title', token: 'ExpoPushToken[Synthetic]' }),
    ).resolves.toMatchObject({ id: expect.stringContaining('disabled:') });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('parses an accepted ticket and receipt from Expo', async () => {
    process.env.EXPO_PUSH_ENABLED = 'true';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'ticket-1', status: 'ok' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { 'ticket-1': { status: 'ok' } } }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ExpoPushAdapter();
    await expect(
      adapter.send({
        body: 'Body',
        data: { orderId: 'synthetic' },
        title: 'Title',
        token: 'ExpoPushToken[Synthetic]',
      }),
    ).resolves.toEqual({ id: 'ticket-1' });
    await expect(adapter.receipts(['ticket-1'])).resolves.toEqual(
      new Map([['ticket-1', { status: 'ok' }]]),
    );
  });
});
