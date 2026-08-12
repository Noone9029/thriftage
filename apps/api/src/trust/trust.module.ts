import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PolicyRepository } from './policy.repository';
import { PolicyService } from './policy.service';
import { SafetyRepository } from './safety.repository';
import { SafetyService } from './safety.service';
import { AdminTrustController, TrustController } from './trust.controller';
import { ReputationReader } from './reputation.reader';

@Module({
  controllers: [TrustController, AdminTrustController],
  imports: [AuthModule],
  providers: [
    { provide: PolicyRepository, useFactory: () => new PolicyRepository() },
    PolicyService,
    { provide: SafetyRepository, useFactory: () => new SafetyRepository() },
    SafetyService,
    { provide: ReputationReader, useFactory: () => new ReputationReader() },
  ],
  exports: [PolicyService, SafetyService, ReputationReader],
})
export class TrustModule {}
