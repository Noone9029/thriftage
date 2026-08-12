import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  pushDeviceInputSchema,
  type NotificationPage,
  type PushDevice,
  type PushDeviceInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotificationService } from './notification.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());
@Controller()
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class NotificationController {
  public constructor(
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}
  @Get('notifications') public list(
    @CurrentUser() user: User,
    @Query() query: { readonly limit?: unknown },
  ): Promise<NotificationPage> {
    return this.notifications.list(user.id, query);
  }
  @Patch('notifications/read-all') public all(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }
  @Patch('notifications/:notificationId/read') public read(
    @CurrentUser() user: User,
    @Param('notificationId', uuidPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }
  @Post('push-devices') public register(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(pushDeviceInputSchema)) input: PushDeviceInput,
  ): Promise<PushDevice> {
    return this.notifications.register(user.id, input);
  }
  @Delete('push-devices/:deviceId') @HttpCode(HttpStatus.NO_CONTENT) public deactivate(
    @CurrentUser() user: User,
    @Param('deviceId', uuidPipe) id: string,
  ): Promise<void> {
    return this.notifications.deactivate(user.id, id);
  }
}
