import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  StructuredLogMarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { ListingImageController } from '../listing-media/listing-image.controller';
import { ListingImageProcessor } from '../listing-media/listing-image-processor';
import { ListingImageService } from '../listing-media/listing-image.service';
import { LISTING_IMAGE_STORAGE } from '../listing-media/listing-image-storage.interface';
import { SupabaseListingImageStorageAdapter } from '../listing-media/supabase-listing-image-storage.adapter';
import { PublicListingController, SellerListingController } from './listing.controller';
import { ListingPresenter } from './listing.presenter';
import { ListingRepository } from './listing.repository';
import { ListingService } from './listing.service';

@Module({
  controllers: [ListingImageController, PublicListingController, SellerListingController],
  exports: [
    LISTING_IMAGE_STORAGE,
    MARKETPLACE_EVENT_PUBLISHER,
    ListingPresenter,
    ListingRepository,
    ListingService,
  ],
  imports: [AuthModule],
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
    {
      provide: MARKETPLACE_EVENT_PUBLISHER,
      useFactory: () => new StructuredLogMarketplaceEventPublisher(),
    },
  ],
})
export class ListingsModule {}
