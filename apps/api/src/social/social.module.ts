import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { SocialController } from './social.controller';
import { SocialRepository } from './social.repository';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController],
  imports: [AuthModule, ListingsModule],
  providers: [
    { provide: SocialRepository, useFactory: () => new SocialRepository() },
    SocialService,
  ],
})
export class SocialModule {}
