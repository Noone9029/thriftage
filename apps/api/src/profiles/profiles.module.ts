import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfileImageProcessor } from './profile-image-processor';
import { PROFILE_IMAGE_STORAGE, type ProfileImageStorage } from './profile-image-storage.interface';
import { ProfileImageService } from './profile-image.service';
import { ProfileRepository, type ProfileRepositoryContract } from './profile.repository';
import { ProfileService } from './profile.service';
import { SupabaseProfileImageStorageAdapter } from './supabase-profile-image-storage.adapter';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

@Module({
  controllers: [ProfileController],
  imports: [AuthModule],
  providers: [
    { provide: PROFILE_REPOSITORY, useFactory: () => new ProfileRepository() },
    { provide: PROFILE_IMAGE_STORAGE, useFactory: () => new SupabaseProfileImageStorageAdapter() },
    ProfileImageProcessor,
    {
      provide: ProfileService,
      inject: [PROFILE_REPOSITORY, MARKETPLACE_EVENT_PUBLISHER],
      useFactory: (repository: ProfileRepositoryContract, events: MarketplaceEventPublisher) =>
        new ProfileService(repository, events),
    },
    {
      provide: ProfileImageService,
      inject: [PROFILE_REPOSITORY, PROFILE_IMAGE_STORAGE, ProfileImageProcessor],
      useFactory: (
        repository: ProfileRepositoryContract,
        storage: ProfileImageStorage,
        processor: ProfileImageProcessor,
      ) => new ProfileImageService(repository, storage, processor),
    },
  ],
})
export class ProfilesModule {}
