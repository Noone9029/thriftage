import { loadApiConfig } from '@thriftage/config/api';
import { createClient } from '@supabase/supabase-js';

import { MarketplaceDomainError } from '../common/marketplace.errors';
import type { ListingImageStorage } from './listing-image-storage.interface';

interface StorageBucketClient {
  createSignedUrls(
    paths: string[],
    expiresIn: number,
  ): Promise<{
    readonly data:
      | readonly {
          readonly error?: string | null;
          readonly path: string | null;
          readonly signedUrl: string | null;
        }[]
      | null;
    readonly error: unknown | null;
  }>;
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

export class SupabaseListingImageStorageAdapter implements ListingImageStorage {
  public constructor(
    private readonly configuredBucket?: StorageBucketClient,
    private readonly configuredTtlSeconds?: number,
  ) {}

  private getSettings(): { readonly bucket: StorageBucketClient; readonly ttlSeconds: number } {
    if (this.configuredBucket !== undefined) {
      return { bucket: this.configuredBucket, ttlSeconds: this.configuredTtlSeconds ?? 900 };
    }
    const config = loadApiConfig(process.env);
    const bucket = createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    }).storage.from(config.listingImageBucket);
    return { bucket, ttlSeconds: config.listingImageSignedUrlTtlSeconds };
  }

  public async createSignedUrls(keys: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (keys.length === 0) return new Map();
    const { bucket, ttlSeconds } = this.getSettings();
    const { data, error } = await bucket.createSignedUrls([...keys], ttlSeconds);
    if (error !== null || data === null || data.length !== keys.length) {
      throw new MarketplaceDomainError('MEDIA_STORAGE_ERROR');
    }
    const urls = new Map<string, string>();
    for (const entry of data) {
      if (entry.path === null || entry.signedUrl === null || entry.error) {
        throw new MarketplaceDomainError('MEDIA_STORAGE_ERROR');
      }
      try {
        urls.set(entry.path, new URL(entry.signedUrl).toString());
      } catch {
        throw new MarketplaceDomainError('MEDIA_STORAGE_ERROR');
      }
    }
    if (urls.size !== keys.length) throw new MarketplaceDomainError('MEDIA_STORAGE_ERROR');
    return urls;
  }

  public async upload(key: string, body: Buffer): Promise<void> {
    const { bucket } = this.getSettings();
    const { error } = await bucket.upload(key, body, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: false,
    });
    if (error !== null) throw new MarketplaceDomainError('MEDIA_STORAGE_ERROR');
  }

  public async remove(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    const { bucket } = this.getSettings();
    const { error } = await bucket.remove([...keys]);
    if (error !== null) throw new MarketplaceDomainError('MEDIA_STORAGE_ERROR');
  }
}
