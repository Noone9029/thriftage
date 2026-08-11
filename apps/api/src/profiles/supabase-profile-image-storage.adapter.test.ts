import { describe, expect, it, vi } from 'vitest';

import { SupabaseProfileImageStorageAdapter } from './supabase-profile-image-storage.adapter';

describe('SupabaseProfileImageStorageAdapter', () => {
  it('uses immutable WebP uploads without upsert and removes exact generated keys', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const remove = vi.fn(async () => ({ error: null }));
    const bucket = {
      getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example.com/profile.webp' } }),
      remove,
      upload,
    };
    const adapter = new SupabaseProfileImageStorageAdapter(bucket);
    await adapter.upload('profiles/user/image.webp', Buffer.from('image'));
    await adapter.remove('profiles/user/image.webp');
    expect(upload).toHaveBeenCalledWith('profiles/user/image.webp', expect.any(Buffer), {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: false,
    });
    expect(remove).toHaveBeenCalledWith(['profiles/user/image.webp']);
  });
});
