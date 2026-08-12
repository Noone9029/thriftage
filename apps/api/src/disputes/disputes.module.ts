import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { AdminDisputeController, DisputeController } from './dispute.controller';
import { DISPUTE_EVIDENCE_STORAGE } from './dispute-evidence-storage.interface';
import { DisputeRepository } from './dispute.repository';
import { DisputeService } from './dispute.service';
import { SupabaseDisputeEvidenceStorageAdapter } from './supabase-dispute-evidence-storage.adapter';
@Module({
  controllers: [DisputeController, AdminDisputeController],
  imports: [AuthModule, ListingsModule],
  providers: [
    { provide: DisputeRepository, useFactory: () => new DisputeRepository() },
    DisputeService,
    {
      provide: DISPUTE_EVIDENCE_STORAGE,
      useFactory: () => new SupabaseDisputeEvidenceStorageAdapter(),
    },
  ],
})
export class DisputesModule {}
