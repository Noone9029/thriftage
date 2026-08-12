import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  conversationStartInputSchema,
  cursorPageQuerySchema,
  messageFlagQuerySchema,
  messageFlagReviewInputSchema,
  messageSendInputSchema,
  type ConversationDetail,
  type ConversationPage,
  type ConversationStartInput,
  type Message,
  type MessageFlag,
  type MessageFlagReviewInput,
  type MessagePage,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommunicationService } from './communication.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('conversations')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class CommunicationController {
  public constructor(
    @Inject(CommunicationService) private readonly communication: CommunicationService,
  ) {}

  @Post()
  public start(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(conversationStartInputSchema)) input: ConversationStartInput,
  ): Promise<ConversationDetail> {
    return this.communication.start(user.id, input);
  }

  @Get()
  public list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: unknown,
  ): Promise<ConversationPage> {
    return this.communication.list(user.id, query);
  }

  @Get(':conversationId')
  public get(
    @CurrentUser() user: User,
    @Param('conversationId', uuidPipe) conversationId: string,
  ): Promise<ConversationDetail> {
    return this.communication.get(user.id, conversationId);
  }

  @Get(':conversationId/messages')
  public messages(
    @CurrentUser() user: User,
    @Param('conversationId', uuidPipe) conversationId: string,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: unknown,
  ): Promise<MessagePage> {
    return this.communication.messages(user.id, conversationId, query);
  }

  @Post(':conversationId/messages')
  public send(
    @CurrentUser() user: User,
    @Param('conversationId', uuidPipe) conversationId: string,
    @Body(new ZodValidationPipe(messageSendInputSchema)) input: { readonly body: string },
  ): Promise<Message> {
    return this.communication.send(user.id, conversationId, input);
  }

  @Patch(':conversationId/read')
  public markRead(
    @CurrentUser() user: User,
    @Param('conversationId', uuidPipe) conversationId: string,
  ): Promise<{ readonly markedRead: number }> {
    return this.communication.markRead(user.id, conversationId);
  }
}

@Controller('admin/message-moderation')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminCommunicationController {
  public constructor(
    @Inject(CommunicationService) private readonly communication: CommunicationService,
  ) {}

  @Get('flags')
  public flags(@Query(new ZodValidationPipe(messageFlagQuerySchema)) query: unknown) {
    return this.communication.listFlags(query);
  }

  @Patch('flags/:flagId')
  public review(
    @CurrentUser() admin: User,
    @Param('flagId', uuidPipe) flagId: string,
    @Body(new ZodValidationPipe(messageFlagReviewInputSchema)) input: MessageFlagReviewInput,
  ): Promise<MessageFlag> {
    return this.communication.reviewFlag(admin.id, flagId, input);
  }

  @Get('conversations/:conversationId')
  public conversation(
    @CurrentUser() admin: User,
    @Param('conversationId', uuidPipe) conversationId: string,
  ) {
    return this.communication.adminConversation(admin.id, conversationId);
  }
}
