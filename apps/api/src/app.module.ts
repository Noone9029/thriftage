import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';

@Module({
  imports: [AuthModule, HealthModule, PhoneVerificationModule],
})
export class AppModule {}
