import { beforeEach, describe, expect, it } from 'vitest';

import { ChunkedSecureStorage } from './chunked-secure-storage';
import type { SecureKeyValueBackend } from './storage.types';

class MemorySecureBackend implements SecureKeyValueBackend {
  public readonly values = new Map<string, string>();

  public async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }

  public async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async setItemAsync(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('ChunkedSecureStorage', () => {
  let backend: MemorySecureBackend;
  let storage: ChunkedSecureStorage;

  beforeEach(() => {
    backend = new MemorySecureBackend();
    storage = new ChunkedSecureStorage(backend, 10);
  });

  it('writes and reads session values', async () => {
    await storage.setItem('session', 'access-refresh');
    await expect(storage.getItem('session')).resolves.toBe('access-refresh');
  });

  it('stores values larger than one secure-store chunk', async () => {
    const value = 'sensitive-session-payload'.repeat(20);
    await storage.setItem('session', value);
    await expect(storage.getItem('session')).resolves.toBe(value);
    expect(
      [...backend.values.keys()].filter((key) => key.includes('__chunk.')).length,
    ).toBeGreaterThan(1);
  });

  it('overwrites a value and cleans old chunks', async () => {
    await storage.setItem('session', 'first-value-spans-chunks');
    const oldChunkKeys = [...backend.values.keys()].filter((key) => key.includes('__chunk.1.'));
    await storage.setItem('session', 'short');

    await expect(storage.getItem('session')).resolves.toBe('short');
    expect(oldChunkKeys.every((key) => !backend.values.has(key))).toBe(true);
  });

  it('removes metadata and every chunk', async () => {
    await storage.setItem('session', 'value-spans-several-chunks');
    await storage.removeItem('session');

    await expect(storage.getItem('session')).resolves.toBeNull();
    expect(backend.values.size).toBe(0);
  });

  it('returns null for a missing value', async () => {
    await expect(storage.getItem('missing')).resolves.toBeNull();
  });

  it('supports empty values', async () => {
    await storage.setItem('empty', '');
    await expect(storage.getItem('empty')).resolves.toBe('');
  });

  it('fails closed when chunk data is incomplete', async () => {
    await storage.setItem('session', 'value-spans-chunks');
    const chunkKey = [...backend.values.keys()].find((key) => key.includes('__chunk.'));
    expect(chunkKey).toBeDefined();
    backend.values.delete(chunkKey!);
    await expect(storage.getItem('session')).rejects.toThrow('incomplete');
  });
});
