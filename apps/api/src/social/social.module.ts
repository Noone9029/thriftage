import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { SocialController } from './social.controller';
import { SocialRepository } from './social.repository';
import { SocialService } from './social.service';
import { TrustModule } from '../trust/trust.module';
import { PersonalizationModule } from '../personalization/personalization.module';

@Module({
  controllers: [SocialController],
  imports: [AuthModule, ListingsModule, PersonalizationModule, TrustModule],
  providers: [
    { provide: SocialRepository, useFactory: () => new SocialRepository() },
    SocialService,
  ],
})
export class SocialModule {}
