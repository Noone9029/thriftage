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
import { MarketplaceEventsModule } from './common/marketplace-events.module';
import { TrustModule } from './trust/trust.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SellerVerificationModule } from './seller-verification/seller-verification.module';
import { DisputesModule } from './disputes/disputes.module';
import { PersonalizationModule } from './personalization/personalization.module';

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
    MarketplaceEventsModule,
    ModerationModule,
    NotificationsModule,
    PhoneVerificationModule,
    PersonalizationModule,
    ProfilesModule,
    SocialModule,
    ReviewsModule,
    SellerVerificationModule,
    DisputesModule,
    TrustModule,
  ],
})
export class AppModule {}
