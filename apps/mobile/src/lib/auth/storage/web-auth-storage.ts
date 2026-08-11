import type { AsyncKeyValueStorage } from './storage.types';

export class WebAuthStorage implements AsyncKeyValueStorage {
  public constructor(private readonly getStorage: () => Storage | undefined) {}

  public async getItem(key: string): Promise<string | null> {
    return this.getStorage()?.getItem(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.getStorage()?.setItem(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.getStorage()?.removeItem(key);
  }
}
