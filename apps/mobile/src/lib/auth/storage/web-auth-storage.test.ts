import { describe, expect, it, vi } from 'vitest';

import { WebAuthStorage } from './web-auth-storage';

describe('WebAuthStorage', () => {
  it('delegates session persistence to browser localStorage', async () => {
    const storage = {
      getItem: vi.fn(() => 'session'),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    } as unknown as Storage;
    const adapter = new WebAuthStorage(() => storage);

    await expect(adapter.getItem('auth')).resolves.toBe('session');
    await adapter.setItem('auth', 'updated');
    await adapter.removeItem('auth');

    expect(storage.setItem).toHaveBeenCalledWith('auth', 'updated');
    expect(storage.removeItem).toHaveBeenCalledWith('auth');
  });

  it('is an empty no-op store during Expo static rendering', async () => {
    const adapter = new WebAuthStorage(() => undefined);

    await expect(adapter.getItem('auth')).resolves.toBeNull();
    await expect(adapter.setItem('auth', 'session')).resolves.toBeUndefined();
    await expect(adapter.removeItem('auth')).resolves.toBeUndefined();
  });
});
