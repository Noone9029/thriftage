import { describe, expect, it, vi } from 'vitest';

import { registerSessionAutoRefresh } from './session-auto-refresh';

describe('registerSessionAutoRefresh', () => {
  it('starts in foreground, responds to state changes, and cleans up once', () => {
    let listener: ((state: string) => void) | undefined;
    const remove = vi.fn();
    const startAutoRefresh = vi.fn();
    const stopAutoRefresh = vi.fn();
    const cleanup = registerSessionAutoRefresh(
      {
        addEventListener: (_event, nextListener) => {
          listener = nextListener;
          return { remove };
        },
        currentState: 'active',
      },
      { startAutoRefresh, stopAutoRefresh },
    );

    expect(startAutoRefresh).toHaveBeenCalledOnce();
    listener?.('background');
    listener?.('active');
    cleanup();

    expect(stopAutoRefresh).toHaveBeenCalledTimes(2);
    expect(startAutoRefresh).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledOnce();
  });
});
