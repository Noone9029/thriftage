import { provisionUserInputSchema } from '@thriftage/shared';

import type { AsyncKeyValueStorage } from './storage.types';

const PENDING_FULL_NAME_KEY = 'thriftage.pending-registration.full-name';

export interface PendingRegistrationStoreContract {
  clear(): Promise<void>;
  getFullName(): Promise<string | null>;
  setFullName(fullName: string): Promise<void>;
}

export class PendingRegistrationStore implements PendingRegistrationStoreContract {
  public constructor(private readonly storage: AsyncKeyValueStorage) {}

  public async getFullName(): Promise<string | null> {
    const value = await this.storage.getItem(PENDING_FULL_NAME_KEY);
    if (value === null) {
      return null;
    }
    const parsed = provisionUserInputSchema.safeParse({ fullName: value });
    if (!parsed.success) {
      await this.clear();
      return null;
    }
    return parsed.data.fullName;
  }

  public async setFullName(fullName: string): Promise<void> {
    const parsed = provisionUserInputSchema.parse({ fullName });
    await this.storage.setItem(PENDING_FULL_NAME_KEY, parsed.fullName);
  }

  public async clear(): Promise<void> {
    await this.storage.removeItem(PENDING_FULL_NAME_KEY);
  }
}
