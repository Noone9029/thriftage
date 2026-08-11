import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { ProfilesModule } from './profiles/profiles.module';

@Module({
  imports: [AdminModule, AuthModule, HealthModule, PhoneVerificationModule, ProfilesModule],
})
export class AppModule {}
