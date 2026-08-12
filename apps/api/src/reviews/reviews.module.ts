import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrustModule } from '../trust/trust.module';
import { AdminReviewController, ReviewController } from './review.controller';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
@Module({
  controllers: [ReviewController, AdminReviewController],
  imports: [AuthModule, TrustModule],
  providers: [
    { provide: ReviewRepository, useFactory: () => new ReviewRepository() },
    ReviewService,
  ],
  exports: [ReviewService],
})
export class ReviewsModule {}
