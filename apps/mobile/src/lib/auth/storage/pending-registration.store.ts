import { phoneNumberSchema, provisionUserInputSchema } from '@thriftage/shared';
import { z } from 'zod';

import type { AsyncKeyValueStorage } from './storage.types';

const PENDING_REGISTRATION_KEY = 'thriftage.pending-registration.v2';
const LEGACY_FULL_NAME_KEY = 'thriftage.pending-registration.full-name';
const pendingRegistrationSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: phoneNumberSchema.optional(),
});

type PendingRegistration = z.infer<typeof pendingRegistrationSchema>;

export interface PendingRegistrationStoreContract {
  clear(): Promise<void>;
  getFullName(): Promise<string | null>;
  getPhone(): Promise<string | null>;
  setFullName(fullName: string): Promise<void>;
  setPhone(phone: string): Promise<void>;
  setRegistration(fullName: string, phone: string): Promise<void>;
}

export class PendingRegistrationStore implements PendingRegistrationStoreContract {
  public constructor(private readonly storage: AsyncKeyValueStorage) {}

  public async getFullName(): Promise<string | null> {
    return (await this.read()).fullName ?? null;
  }

  public async getPhone(): Promise<string | null> {
    return (await this.read()).phone ?? null;
  }

  public async setRegistration(fullName: string, phone: string): Promise<void> {
    const parsedName = provisionUserInputSchema.parse({ fullName }).fullName;
    const parsedPhone = phoneNumberSchema.parse(phone);
    await this.write({ fullName: parsedName, phone: parsedPhone });
  }

  public async setFullName(fullName: string): Promise<void> {
    const parsed = provisionUserInputSchema.parse({ fullName });
    await this.write({ ...(await this.read()), fullName: parsed.fullName });
  }

  public async setPhone(phone: string): Promise<void> {
    await this.write({ ...(await this.read()), phone: phoneNumberSchema.parse(phone) });
  }

  public async clear(): Promise<void> {
    await Promise.all([
      this.storage.removeItem(PENDING_REGISTRATION_KEY),
      this.storage.removeItem(LEGACY_FULL_NAME_KEY),
    ]);
  }

  private async read(): Promise<PendingRegistration> {
    const value = await this.storage.getItem(PENDING_REGISTRATION_KEY);
    if (value === null) return {};
    try {
      const parsed = pendingRegistrationSchema.safeParse(JSON.parse(value));
      if (parsed.success) return parsed.data;
    } catch {
      // Invalid stale local state is cleared below.
    }
    await this.clear();
    return {};
  }

  private async write(value: PendingRegistration): Promise<void> {
    const parsed = pendingRegistrationSchema.parse(value);
    await this.storage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(parsed));
  }
}
