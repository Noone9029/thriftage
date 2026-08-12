import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingImageController } from '../listing-media/listing-image.controller';
import { ListingImageProcessor } from '../listing-media/listing-image-processor';
import { ListingImageService } from '../listing-media/listing-image.service';
import { LISTING_IMAGE_STORAGE } from '../listing-media/listing-image-storage.interface';
import { SupabaseListingImageStorageAdapter } from '../listing-media/supabase-listing-image-storage.adapter';
import { PublicListingController, SellerListingController } from './listing.controller';
import { ListingPresenter } from './listing.presenter';
import { ListingRepository } from './listing.repository';
import { ListingService } from './listing.service';
import { TrustModule } from '../trust/trust.module';

@Module({
  controllers: [ListingImageController, PublicListingController, SellerListingController],
  exports: [
    LISTING_IMAGE_STORAGE,
    ListingPresenter,
    ListingRepository,
    ListingService,
    ListingImageProcessor,
  ],
  imports: [AuthModule, TrustModule],
  providers: [
    ListingImageProcessor,
    ListingImageService,
    ListingPresenter,
    { provide: ListingRepository, useFactory: () => new ListingRepository() },
    ListingService,
    {
      provide: LISTING_IMAGE_STORAGE,
      useFactory: () => new SupabaseListingImageStorageAdapter(),
    },
  ],
})
export class ListingsModule {}
