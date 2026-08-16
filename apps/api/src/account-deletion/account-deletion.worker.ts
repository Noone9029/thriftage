import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import type { AccountDeletionRequest } from '@thriftage/db';

import {
  ACCOUNT_DELETION_AUTH_ADMIN,
  type AccountDeletionAuthAdmin,
} from './account-deletion-auth.interface';
import { AccountDeletionRepository } from './account-deletion.repository';
import type { ListingImageStorage } from '../listing-media/listing-image-storage.interface';
import { LISTING_IMAGE_STORAGE } from '../listing-media/listing-image-storage.interface';
import type { ProfileImageStorage } from '../profiles/profile-image-storage.interface';
import { PROFILE_IMAGE_STORAGE } from '../profiles/profile-image-storage.interface';

function operationalErrorCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{2,63}$/.test(error.message)) return error.message;
  return 'ACCOUNT_DELETION_STEP_FAILED';
}

@Injectable()
export class AccountDeletionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionWorker.name);
  private running = false;
  private timer?: ReturnType<typeof setInterval>;

  public constructor(
    @Inject(AccountDeletionRepository) private readonly repository: AccountDeletionRepository,
    @Inject(ACCOUNT_DELETION_AUTH_ADMIN) private readonly authAdmin: AccountDeletionAuthAdmin,
    @Inject(PROFILE_IMAGE_STORAGE) private readonly profileStorage: ProfileImageStorage,
    @Inject(LISTING_IMAGE_STORAGE) private readonly listingStorage: ListingImageStorage,
  ) {}

  public onModuleInit(): void {
    const interval = loadApiConfig(process.env).accountDeletionPollIntervalMs;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  public async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const config = loadApiConfig(process.env);
      if (!config.accountDeletionEnabled) return;
      const requests = await this.repository.claim(
        config.accountDeletionBatchSize,
        config.accountDeletionStaleLockSeconds,
      );
      for (const request of requests)
        await this.process(request, config.accountDeletionMaxAttempts);
    } catch {
      this.logger.error('Account deletion polling failed: code=ACCOUNT_DELETION_POLL_FAILED');
    } finally {
      this.running = false;
    }
  }

  private async process(request: AccountDeletionRequest, maxAttempts: number): Promise<void> {
    try {
      if (request.mediaDeletedAt === null) {
        const media = await this.repository.getMedia(request.userId);
        if (media.profileImageKey !== null) await this.profileStorage.remove(media.profileImageKey);
        for (let start = 0; start < media.listingImageKeys.length; start += 100) {
          await this.listingStorage.remove(media.listingImageKeys.slice(start, start + 100));
        }
        await this.repository.markMediaDeleted(request.id);
      }

      if (request.dataAnonymizedAt === null) {
        await this.repository.anonymizeApplicationData(request);
      }

      if (request.authIdentityDeletedAt === null) {
        if (request.authProviderUserId === null) throw new Error('AUTH_IDENTITY_REFERENCE_MISSING');
        await this.authAdmin.deleteIdentity(request.authProviderUserId);
        await this.repository.markAuthIdentityDeleted(request.id);
      }

      await this.repository.complete(request.id);
      this.logger.log(`Account deletion completed: requestId=${request.id}`);
    } catch (error: unknown) {
      const code = operationalErrorCode(error);
      await this.repository.fail(request, code, maxAttempts);
      this.logger.warn(
        `Account deletion attempt failed: requestId=${request.id} attempt=${request.attempts} code=${code}`,
      );
    }
  }
}
