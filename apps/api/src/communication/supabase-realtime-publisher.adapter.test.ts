import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SupabaseRealtimePublisherAdapter } from './supabase-realtime-publisher.adapter';

const event = {
  conversationId: '1ecd4c1c-5726-429e-983e-0708e9dc336b',
  createdAt: '2026-08-20T12:00:00.000Z',
  messageId: '655d22c9-fbb7-42d4-99af-e7f4ad954476',
} as const;

describe('SupabaseRealtimePublisherAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('PHONE_AUTH_ENABLED', 'false');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-placeholder');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-placeholder');
    vi.stubEnv('SUPABASE_URL', 'https://project-ref.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not publish when realtime broadcast is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await new SupabaseRealtimePublisherAdapter().publishMessage(event);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the private Realtime REST broadcast endpoint and secret API key header', async () => {
    vi.stubEnv('REALTIME_BROADCAST_ENABLED', 'true');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await new SupabaseRealtimePublisherAdapter().publishMessage(event);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://project-ref.supabase.co/realtime/v1/api/broadcast/conversation:${event.conversationId}/events/message-created?private=true`,
      {
        body: JSON.stringify(event),
        headers: {
          apikey: 'sb_secret_test-placeholder',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('surfaces provider failures without leaking response content', async () => {
    vi.stubEnv('REALTIME_BROADCAST_ENABLED', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('provider details', { status: 500 })),
    );

    await expect(new SupabaseRealtimePublisherAdapter().publishMessage(event)).rejects.toThrow(
      'REALTIME_BROADCAST_FAILED',
    );
  });
});
