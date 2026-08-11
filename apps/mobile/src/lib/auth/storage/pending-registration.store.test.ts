import { describe, expect, it } from 'vitest';

import { PendingRegistrationStore } from './pending-registration.store';
import type { AsyncKeyValueStorage } from './storage.types';

class MemoryStorage implements AsyncKeyValueStorage {
  public readonly values = new Map<string, string>();
  public async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  public async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
  public async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('PendingRegistrationStore', () => {
  it('persists normalized non-secret registration continuity data and clears it', async () => {
    const storage = new MemoryStorage();
    const pending = new PendingRegistrationStore(storage);
    await pending.setRegistration('  Ayesha Khan  ', '+923001234567');
    await expect(pending.getFullName()).resolves.toBe('Ayesha Khan');
    await expect(pending.getPhone()).resolves.toBe('+923001234567');
    expect([...storage.values.values()].join('')).not.toContain('password');
    await pending.clear();
    await expect(pending.getFullName()).resolves.toBeNull();
    await expect(pending.getPhone()).resolves.toBeNull();
  });

  it('supports cross-device account completion without inventing a phone', async () => {
    const pending = new PendingRegistrationStore(new MemoryStorage());
    await pending.setFullName('Ayesha Khan');
    await expect(pending.getFullName()).resolves.toBe('Ayesha Khan');
    await expect(pending.getPhone()).resolves.toBeNull();
  });

  it('clears invalid stale data instead of using it', async () => {
    const storage = new MemoryStorage();
    storage.values.set('thriftage.pending-registration.v2', '{invalid');
    const pending = new PendingRegistrationStore(storage);
    await expect(pending.getFullName()).resolves.toBeNull();
    expect(storage.values.size).toBe(0);
  });
});
