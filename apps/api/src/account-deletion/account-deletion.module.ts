import { Module } from '@nestjs/common';

import { ACCOUNT_DELETION_AUTH_ADMIN } from './account-deletion-auth.interface';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionRepository } from './account-deletion.repository';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionWorker } from './account-deletion.worker';
import { SupabaseAccountDeletionAuthAdapter } from './supabase-account-deletion-auth.adapter';
import { AuthModule } from '../auth/auth.module';
import { LISTING_IMAGE_STORAGE } from '../listing-media/listing-image-storage.interface';
import { SupabaseListingImageStorageAdapter } from '../listing-media/supabase-listing-image-storage.adapter';
import { PROFILE_IMAGE_STORAGE } from '../profiles/profile-image-storage.interface';
import { SupabaseProfileImageStorageAdapter } from '../profiles/supabase-profile-image-storage.adapter';

@Module({
  controllers: [AccountDeletionController],
  imports: [AuthModule],
  providers: [
    AccountDeletionRepository,
    AccountDeletionService,
    AccountDeletionWorker,
    {
      provide: ACCOUNT_DELETION_AUTH_ADMIN,
      useFactory: () => new SupabaseAccountDeletionAuthAdapter(),
    },
    {
      provide: PROFILE_IMAGE_STORAGE,
      useFactory: () => new SupabaseProfileImageStorageAdapter(),
    },
    {
      provide: LISTING_IMAGE_STORAGE,
      useFactory: () => new SupabaseListingImageStorageAdapter(),
    },
  ],
})
export class AccountDeletionModule {}
