import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminFeedbackController, FeedbackController } from './feedback.controller';
import { FeedbackRepository } from './feedback.repository';
import { FeedbackService } from './feedback.service';

@Module({
  controllers: [AdminFeedbackController, FeedbackController],
  imports: [AuthModule],
  providers: [
    {
      provide: FeedbackRepository,
      useFactory: () => new FeedbackRepository(),
    },
    FeedbackService,
  ],
})
export class FeedbackModule {}
