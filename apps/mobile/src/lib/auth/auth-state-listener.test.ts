import type { Session } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { registerAuthStateListener } from './auth-state-listener';

describe('registerAuthStateListener', () => {
  it('forwards events and returns the provider cleanup function', async () => {
    const unsubscribe = vi.fn();
    let listener:
      Parameters<Parameters<typeof registerAuthStateListener>[0]['subscribe']>[0] | undefined;
    const handler = vi.fn().mockResolvedValue(undefined);
    const cleanup = registerAuthStateListener(
      {
        subscribe: (nextListener) => {
          listener = nextListener;
          return unsubscribe;
        },
      },
      handler,
      vi.fn(),
    );

    listener?.('SIGNED_IN', {} as Session);
    await Promise.resolve();
    expect(handler).toHaveBeenCalledOnce();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
