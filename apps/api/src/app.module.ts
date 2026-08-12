import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { ProfilesModule } from './profiles/profiles.module';
import { CategoriesModule } from './categories/categories.module';
import { CommunicationModule } from './communication/communication.module';
import { CommerceModule } from './commerce/commerce.module';
import { ListingsModule } from './listings/listings.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { SocialModule } from './social/social.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    CategoriesModule,
    CommunicationModule,
    CommerceModule,
    DiscoveryModule,
    HealthModule,
    ListingsModule,
    ModerationModule,
    NotificationsModule,
    PhoneVerificationModule,
    ProfilesModule,
    SocialModule,
  ],
})
export class AppModule {}
