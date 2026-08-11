import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { ProfilesModule } from './profiles/profiles.module';
import { CategoriesModule } from './categories/categories.module';
import { ListingsModule } from './listings/listings.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { SocialModule } from './social/social.module';
import { ModerationModule } from './moderation/moderation.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    CategoriesModule,
    DiscoveryModule,
    HealthModule,
    ListingsModule,
    ModerationModule,
    PhoneVerificationModule,
    ProfilesModule,
    SocialModule,
  ],
})
export class AppModule {}
