import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { AdminCommunicationController, CommunicationController } from './communication.controller';
import { CommunicationPresenter } from './communication.presenter';
import { CommunicationRepository } from './communication.repository';
import { CommunicationService } from './communication.service';
import { ContactInformationDetector } from './contact-information-detector';
import { REALTIME_PUBLISHER } from './realtime-publisher.interface';
import { SupabaseRealtimePublisherAdapter } from './supabase-realtime-publisher.adapter';

@Module({
  controllers: [CommunicationController, AdminCommunicationController],
  exports: [CommunicationService],
  imports: [AuthModule, ListingsModule],
  providers: [
    { provide: CommunicationRepository, useFactory: () => new CommunicationRepository() },
    CommunicationPresenter,
    ContactInformationDetector,
    CommunicationService,
    { provide: REALTIME_PUBLISHER, useFactory: () => new SupabaseRealtimePublisherAdapter() },
  ],
})
export class CommunicationModule {}
