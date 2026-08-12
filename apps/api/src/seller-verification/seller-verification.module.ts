import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminSellerVerificationController,
  SellerVerificationController,
} from './seller-verification.controller';
import { SellerVerificationRepository } from './seller-verification.repository';
import { SellerVerificationService } from './seller-verification.service';
@Module({
  controllers: [SellerVerificationController, AdminSellerVerificationController],
  imports: [AuthModule],
  providers: [
    { provide: SellerVerificationRepository, useFactory: () => new SellerVerificationRepository() },
    SellerVerificationService,
  ],
})
export class SellerVerificationModule {}
