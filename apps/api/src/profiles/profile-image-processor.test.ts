import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { MAX_PROFILE_IMAGE_BYTES, ProfileImageProcessor } from './profile-image-processor';

describe('ProfileImageProcessor', () => {
  it('validates, strips metadata, resizes, and re-encodes a profile image', async () => {
    const source = await sharp({
      create: { background: '#17664f', channels: 3, height: 300, width: 400 },
    })
      .jpeg()
      .toBuffer();
    const result = await new ProfileImageProcessor().process({
      buffer: source,
      mimetype: 'image/jpeg',
      size: source.length,
    });
    const metadata = await sharp(result).metadata();
    expect(metadata).toMatchObject({ format: 'webp', height: 512, width: 512 });
  });

  it('rejects spoofed and oversized uploads', async () => {
    const processor = new ProfileImageProcessor();
    await expect(
      processor.process({ buffer: Buffer.from('not an image'), mimetype: 'image/jpeg', size: 12 }),
    ).rejects.toMatchObject({ code: 'PROFILE_IMAGE_INVALID' });
    await expect(
      processor.process({
        buffer: Buffer.alloc(1),
        mimetype: 'image/png',
        size: MAX_PROFILE_IMAGE_BYTES + 1,
      }),
    ).rejects.toMatchObject({ code: 'PROFILE_IMAGE_TOO_LARGE' });
  });
});
