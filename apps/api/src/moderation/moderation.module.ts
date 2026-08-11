import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { AdminModerationController, ReportController } from './moderation.controller';
import { ModerationRepository } from './moderation.repository';
import { ModerationService } from './moderation.service';

@Module({
  controllers: [AdminModerationController, ReportController],
  imports: [AuthModule, ListingsModule],
  providers: [
    { provide: ModerationRepository, useFactory: () => new ModerationRepository() },
    ModerationService,
  ],
})
export class ModerationModule {}
