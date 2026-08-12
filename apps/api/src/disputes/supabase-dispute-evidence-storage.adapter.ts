import { loadApiConfig } from '@thriftage/config/api';
import { createClient } from '@supabase/supabase-js';
import { DisputeDomainError } from './dispute.errors';
import type { DisputeEvidenceStorage } from './dispute-evidence-storage.interface';
export class SupabaseDisputeEvidenceStorageAdapter implements DisputeEvidenceStorage {
  private bucket() {
    const c = loadApiConfig(process.env);
    return {
      client: createClient(c.supabaseUrl, c.supabaseSecretKey, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      }).storage.from(c.disputeEvidenceBucket),
      ttl: c.disputeEvidenceSignedUrlTtlSeconds,
    };
  }
  async upload(key: string, body: Buffer) {
    const { error } = await this.bucket().client.upload(key, body, {
      contentType: 'image/webp',
      cacheControl: 'private, no-store',
      upsert: false,
    });
    if (error) throw new DisputeDomainError('DISPUTE_SERVICE_ERROR');
  }
  async remove(keys: readonly string[]) {
    if (keys.length === 0) return;
    const { error } = await this.bucket().client.remove([...keys]);
    if (error) throw new DisputeDomainError('DISPUTE_SERVICE_ERROR');
  }
  async signedUrls(keys: readonly string[]) {
    if (keys.length === 0) return new Map();
    const { client, ttl } = this.bucket();
    const { data, error } = await client.createSignedUrls([...keys], ttl);
    if (error || !data) throw new DisputeDomainError('DISPUTE_SERVICE_ERROR');
    const map = new Map<string, string>();
    for (const x of data) {
      if (!x.path || !x.signedUrl || x.error) throw new DisputeDomainError('DISPUTE_SERVICE_ERROR');
      map.set(x.path, new URL(x.signedUrl).toString());
    }
    return map;
  }
}
