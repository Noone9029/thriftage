import sharp from 'sharp';

import { MarketplaceDomainError } from '../common/marketplace.errors';

export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_IMAGE_DIMENSION = 320;
const allowedDeclaredTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedFormats = new Set(['jpeg', 'png', 'webp']);

export interface UploadedListingImage {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly size: number;
}

export interface ProcessedListingImage {
  readonly body: Buffer;
  readonly height: number;
  readonly width: number;
}

export class ListingImageProcessor {
  public async process(file: UploadedListingImage | undefined): Promise<ProcessedListingImage> {
    if (file === undefined) throw new MarketplaceDomainError('IMAGE_INVALID');
    if (file.size > MAX_LISTING_IMAGE_BYTES) {
      throw new MarketplaceDomainError('IMAGE_TOO_LARGE');
    }
    if (!allowedDeclaredTypes.has(file.mimetype)) {
      throw new MarketplaceDomainError('IMAGE_INVALID');
    }

    try {
      const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });
      const metadata = await image.metadata();
      if (
        metadata.format === undefined ||
        !allowedFormats.has(metadata.format) ||
        metadata.width === undefined ||
        metadata.height === undefined ||
        metadata.width < MIN_IMAGE_DIMENSION ||
        metadata.height < MIN_IMAGE_DIMENSION ||
        (metadata.pages ?? 1) !== 1
      ) {
        throw new MarketplaceDomainError('IMAGE_INVALID');
      }
      const body = await image
        .rotate()
        .resize(1600, 2000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
      const outputMetadata = await sharp(body).metadata();
      if (outputMetadata.width === undefined || outputMetadata.height === undefined) {
        throw new MarketplaceDomainError('IMAGE_INVALID');
      }
      return { body, height: outputMetadata.height, width: outputMetadata.width };
    } catch (error: unknown) {
      if (error instanceof MarketplaceDomainError) throw error;
      throw new MarketplaceDomainError('IMAGE_INVALID');
    }
  }
}
