import { loadApiConfig } from '@thriftage/config/api';
import { createClient } from '@supabase/supabase-js';

import { ProfileDomainError } from './profile.errors';
import type { ProfileImageStorage } from './profile-image-storage.interface';

interface StorageBucketClient {
  getPublicUrl(key: string): { readonly data: { readonly publicUrl: string } };
  remove(keys: string[]): Promise<{ readonly error: unknown | null }>;
  upload(
    key: string,
    body: Buffer,
    options: {
      readonly cacheControl: string;
      readonly contentType: string;
      readonly upsert: false;
    },
  ): Promise<{ readonly error: unknown | null }>;
}

export class SupabaseProfileImageStorageAdapter implements ProfileImageStorage {
  public constructor(private readonly configuredBucket?: StorageBucketClient) {}

  private getBucket(): StorageBucketClient {
    if (this.configuredBucket !== undefined) return this.configuredBucket;
    const config = loadApiConfig(process.env);
    return createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    }).storage.from(config.profileImageBucket);
  }

  public getPublicUrl(key: string): string {
    const url = this.getBucket().getPublicUrl(key).data.publicUrl;
    try {
      return new URL(url).toString();
    } catch {
      throw new ProfileDomainError('PROFILE_IMAGE_STORAGE_ERROR');
    }
  }

  public async upload(key: string, body: Buffer): Promise<void> {
    const { error } = await this.getBucket().upload(key, body, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: false,
    });
    if (error !== null) throw new ProfileDomainError('PROFILE_IMAGE_STORAGE_ERROR');
  }

  public async remove(key: string): Promise<void> {
    const { error } = await this.getBucket().remove([key]);
    if (error !== null) throw new ProfileDomainError('PROFILE_IMAGE_STORAGE_ERROR');
  }
}
