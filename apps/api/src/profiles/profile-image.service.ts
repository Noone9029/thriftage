import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { serializePrivateUserProfile, type PrivateUserProfile } from '@thriftage/shared';

import { mapProfileError } from './profile.errors';
import type { ProfileImageProcessor, UploadedProfileImage } from './profile-image-processor';
import type { ProfileImageStorage } from './profile-image-storage.interface';
import type { ProfileRepositoryContract } from './profile.repository';

export class ProfileImageService {
  private readonly logger = new Logger(ProfileImageService.name);

  public constructor(
    private readonly repository: ProfileRepositoryContract,
    private readonly storage: ProfileImageStorage,
    private readonly processor: ProfileImageProcessor,
  ) {}

  public async upload(
    userId: string,
    file: UploadedProfileImage | undefined,
  ): Promise<PrivateUserProfile> {
    try {
      const body = await this.processor.process(file);
      const newKey = `profiles/${userId}/${randomUUID()}.webp`;
      await this.storage.upload(newKey, body);
      const publicUrl = this.storage.getPublicUrl(newKey);
      let result;
      try {
        result = await this.repository.setImage(userId, newKey, publicUrl);
      } catch (error: unknown) {
        await this.storage.remove(newKey).catch(() => undefined);
        throw error;
      }
      if (result.previousKey !== null && result.previousKey !== newKey) {
        await this.removeOrRecordOrphan(result.previousKey);
      }
      return serializePrivateUserProfile(result.profile);
    } catch (error: unknown) {
      throw mapProfileError(error);
    }
  }

  public async remove(userId: string): Promise<PrivateUserProfile> {
    try {
      const result = await this.repository.clearImage(userId);
      if (result.previousKey !== null) await this.removeOrRecordOrphan(result.previousKey);
      return serializePrivateUserProfile(result.profile);
    } catch (error: unknown) {
      throw mapProfileError(error);
    }
  }

  private async removeOrRecordOrphan(key: string): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch {
      this.logger.warn('Profile image cleanup deferred: code=PROFILE_IMAGE_CLEANUP_DEFERRED');
    }
  }
}
