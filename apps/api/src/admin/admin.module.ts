import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminAccessController } from './admin-access.controller';

@Module({ controllers: [AdminAccessController], imports: [AuthModule] })
export class AdminModule {}
