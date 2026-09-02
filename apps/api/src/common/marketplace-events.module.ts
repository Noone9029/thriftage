import { Global, Module } from '@nestjs/common';

import {
  MARKETPLACE_EVENT_PUBLISHER,
  PersistentMarketplaceEventPublisher,
} from './marketplace-event-publisher';

@Global()
@Module({
  exports: [MARKETPLACE_EVENT_PUBLISHER],
  providers: [
    {
      provide: MARKETPLACE_EVENT_PUBLISHER,
      useFactory: () => new PersistentMarketplaceEventPublisher(),
    },
  ],
})
export class MarketplaceEventsModule {}
