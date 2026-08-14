import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingPresenter } from '../listings/listing.presenter';
import { ListingRepository } from '../listings/listing.repository';
import { ListingsModule } from '../listings/listings.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { PersonalizationService } from '../personalization/personalization.service';
import {
  AiStylistAdminController,
  AiStylistAttributionController,
  AiStylistConversationController,
  AiStylistSavedOutfitController,
} from './ai-stylist.controller';
import { AiStylistRepository } from './ai-stylist.repository';
import { AiStylistService } from './ai-stylist.service';
import { AiStylistToolRegistry } from './ai-stylist-tool-registry';
import { AI_STYLIST_PROVIDER } from './ai-stylist.types';
import { UnavailableAiStylistProvider } from './fake-ai-stylist.provider';
import { OpenAiStylistAdapter } from './openai-stylist.adapter';
import { StylistInventoryService } from './stylist-inventory.service';

@Module({
  controllers: [
    AiStylistAdminController,
    AiStylistAttributionController,
    AiStylistConversationController,
    AiStylistSavedOutfitController,
  ],
  exports: [AiStylistService],
  imports: [AuthModule, ListingsModule, PersonalizationModule],
  providers: [
    { provide: AiStylistRepository, useFactory: () => new AiStylistRepository() },
    {
      inject: [ListingRepository, ListingPresenter, PersonalizationService],
      provide: StylistInventoryService,
      useFactory: (
        listings: ListingRepository,
        presenter: ListingPresenter,
        personalization: PersonalizationService,
      ) => new StylistInventoryService(listings, presenter, personalization),
    },
    AiStylistToolRegistry,
    {
      provide: AI_STYLIST_PROVIDER,
      useFactory: () => {
        const key = process.env.OPENAI_API_KEY?.trim();
        return key === undefined || key.length < 16
          ? new UnavailableAiStylistProvider()
          : new OpenAiStylistAdapter(key);
      },
    },
    AiStylistService,
  ],
})
export class AiStylistModule {}
