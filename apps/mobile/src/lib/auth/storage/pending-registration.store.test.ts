import { describe, expect, it } from 'vitest';

import { PendingRegistrationStore } from './pending-registration.store';
import type { AsyncKeyValueStorage } from './storage.types';

class MemoryStorage implements AsyncKeyValueStorage {
  public value: string | null = null;
  public async getItem(): Promise<string | null> {
    return this.value;
  }
  public async removeItem(): Promise<void> {
    this.value = null;
  }
  public async setItem(_key: string, value: string): Promise<void> {
    this.value = value;
  }
}

describe('PendingRegistrationStore', () => {
  it('persists only a normalized full name and clears it', async () => {
    const storage = new MemoryStorage();
    const pending = new PendingRegistrationStore(storage);
    await pending.setFullName('  Ayesha Khan  ');
    expect(storage.value).toBe('Ayesha Khan');
    await expect(pending.getFullName()).resolves.toBe('Ayesha Khan');
    await pending.clear();
    await expect(pending.getFullName()).resolves.toBeNull();
  });

  it('clears invalid stale data instead of using it for provisioning', async () => {
    const storage = new MemoryStorage();
    storage.value = '   ';
    const pending = new PendingRegistrationStore(storage);
    await expect(pending.getFullName()).resolves.toBeNull();
    expect(storage.value).toBeNull();
  });
});
