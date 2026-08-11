import sharp from 'sharp';

import { ProfileDomainError } from './profile.errors';

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_PROFILE_IMAGE_DIMENSION = 128;
const MAX_INPUT_PIXELS = 36_000_000;
const allowedDeclaredTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedFormats = new Set(['jpeg', 'png', 'webp']);

export interface UploadedProfileImage {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly size: number;
}

export class ProfileImageProcessor {
  public async process(file: UploadedProfileImage | undefined): Promise<Buffer> {
    if (file === undefined) throw new ProfileDomainError('PROFILE_IMAGE_INVALID');
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      throw new ProfileDomainError('PROFILE_IMAGE_TOO_LARGE');
    }
    if (!allowedDeclaredTypes.has(file.mimetype)) {
      throw new ProfileDomainError('PROFILE_IMAGE_INVALID');
    }

    try {
      const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });
      const metadata = await image.metadata();
      if (
        metadata.format === undefined ||
        !allowedFormats.has(metadata.format) ||
        metadata.width === undefined ||
        metadata.height === undefined ||
        metadata.width < MIN_PROFILE_IMAGE_DIMENSION ||
        metadata.height < MIN_PROFILE_IMAGE_DIMENSION ||
        (metadata.pages ?? 1) !== 1
      ) {
        throw new ProfileDomainError('PROFILE_IMAGE_INVALID');
      }
      return await image
        .rotate()
        .resize(512, 512, { fit: 'cover', position: 'attention' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch (error: unknown) {
      if (error instanceof ProfileDomainError) throw error;
      throw new ProfileDomainError('PROFILE_IMAGE_INVALID');
    }
  }
}
