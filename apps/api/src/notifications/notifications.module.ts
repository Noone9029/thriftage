import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ExpoPushAdapter } from './expo-push.adapter';
import { NotificationController } from './notification.controller';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { PUSH_PROVIDER } from './push-provider.interface';

@Module({
  controllers: [NotificationController],
  imports: [AuthModule],
  providers: [
    ExpoPushAdapter,
    NotificationOutboxWorker,
    { provide: NotificationRepository, useFactory: () => new NotificationRepository() },
    NotificationService,
    { provide: PUSH_PROVIDER, useExisting: ExpoPushAdapter },
  ],
})
export class NotificationsModule {}
