import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, HealthModule],
})
export class AppModule {}
