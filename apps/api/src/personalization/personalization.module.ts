import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import {
  PersonalizationAdminController,
  PersonalizationController,
} from './personalization.controller';
import { PersonalizationService } from './personalization.service';

@Module({
  controllers: [PersonalizationController, PersonalizationAdminController],
  exports: [PersonalizationService],
  imports: [AuthModule],
  providers: [{ provide: PersonalizationService, useFactory: () => new PersonalizationService() }],
})
export class PersonalizationModule {}
