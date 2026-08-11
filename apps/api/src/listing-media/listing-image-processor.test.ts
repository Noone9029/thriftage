import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { ListingImageProcessor, MAX_LISTING_IMAGE_BYTES } from './listing-image-processor';

describe('ListingImageProcessor', () => {
  it('normalizes valid marketplace media to bounded WebP output', async () => {
    const source = await sharp({
      create: { background: '#805f48', channels: 3, height: 2400, width: 1800 },
    })
      .jpeg()
      .toBuffer();
    const result = await new ListingImageProcessor().process({
      buffer: source,
      mimetype: 'image/jpeg',
      size: source.length,
    });
    const metadata = await sharp(result.body).metadata();
    expect(metadata.format).toBe('webp');
    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.height).toBeLessThanOrEqual(2000);
  });

  it('rejects spoofed, undersized, and oversized uploads', async () => {
    const processor = new ListingImageProcessor();
    await expect(
      processor.process({ buffer: Buffer.from('not an image'), mimetype: 'image/jpeg', size: 12 }),
    ).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
    const tiny = await sharp({
      create: { background: '#000000', channels: 3, height: 100, width: 100 },
    })
      .jpeg()
      .toBuffer();
    await expect(
      processor.process({ buffer: tiny, mimetype: 'image/jpeg', size: tiny.length }),
    ).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
    await expect(
      processor.process({
        buffer: Buffer.alloc(1),
        mimetype: 'image/png',
        size: MAX_LISTING_IMAGE_BYTES + 1,
      }),
    ).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
  });
});
