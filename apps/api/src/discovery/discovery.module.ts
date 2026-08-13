import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryRepository } from './discovery.repository';
import { DiscoveryService } from './discovery.service';
import { PersonalizationModule } from '../personalization/personalization.module';

@Module({
  controllers: [DiscoveryController],
  imports: [AuthModule, ListingsModule, PersonalizationModule],
  providers: [
    { provide: DiscoveryRepository, useFactory: () => new DiscoveryRepository() },
    DiscoveryService,
  ],
})
export class DiscoveryModule {}
