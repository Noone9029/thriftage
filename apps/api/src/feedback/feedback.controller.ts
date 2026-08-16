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
  aiResponseFeedbackInputSchema,
  betaFeedbackInputSchema,
  feedbackModerationInputSchema,
  feedbackQueueQuerySchema,
  type AiResponseFeedbackInput,
  type BetaFeedbackInput,
  type FeedbackModerationInput,
  type FeedbackQueueQuery,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FeedbackService } from './feedback.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('feedback')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class FeedbackController {
  public constructor(@Inject(FeedbackService) private readonly feedback: FeedbackService) {}

  @Post()
  public beta(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(betaFeedbackInputSchema)) input: BetaFeedbackInput,
  ) {
    return this.feedback.submitBeta(user.id, input);
  }

  @Post('ai-stylist/generations/:generationId')
  public ai(
    @CurrentUser() user: User,
    @Param('generationId', uuidPipe) generationId: string,
    @Body(new ZodValidationPipe(aiResponseFeedbackInputSchema)) input: AiResponseFeedbackInput,
  ) {
    return this.feedback.submitAi(user.id, generationId, input);
  }
}

@Controller('admin/feedback')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminFeedbackController {
  public constructor(@Inject(FeedbackService) private readonly feedback: FeedbackService) {}

  @Get('beta')
  public listBeta(
    @Query(new ZodValidationPipe(feedbackQueueQuerySchema)) query: FeedbackQueueQuery,
  ) {
    return this.feedback.listBeta(query);
  }

  @Patch('beta/:id')
  public moderateBeta(
    @CurrentUser() admin: User,
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(feedbackModerationInputSchema)) input: FeedbackModerationInput,
  ) {
    return this.feedback.moderateBeta(admin.id, id, input);
  }

  @Get('ai')
  public listAi(@Query(new ZodValidationPipe(feedbackQueueQuerySchema)) query: FeedbackQueueQuery) {
    return this.feedback.listAi(query);
  }

  @Patch('ai/:id')
  public moderateAi(
    @CurrentUser() admin: User,
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(feedbackModerationInputSchema)) input: FeedbackModerationInput,
  ) {
    return this.feedback.moderateAi(admin.id, id, input);
  }
}
