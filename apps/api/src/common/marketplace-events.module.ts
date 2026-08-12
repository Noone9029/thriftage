import { Global, Module } from '@nestjs/common';

import {
  MARKETPLACE_EVENT_PUBLISHER,
  StructuredLogMarketplaceEventPublisher,
} from './marketplace-event-publisher';

@Global()
@Module({
  exports: [MARKETPLACE_EVENT_PUBLISHER],
  providers: [
    {
      provide: MARKETPLACE_EVENT_PUBLISHER,
      useFactory: () => new StructuredLogMarketplaceEventPublisher(),
    },
  ],
})
export class MarketplaceEventsModule {}
