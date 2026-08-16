import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminAccessController } from './admin-access.controller';
import { ClosedBetaOperationsController } from './closed-beta-operations.controller';
import { ClosedBetaOperationsService } from './closed-beta-operations.service';

@Module({
  controllers: [AdminAccessController, ClosedBetaOperationsController],
  imports: [AuthModule],
  providers: [ClosedBetaOperationsService],
})
export class AdminModule {}
