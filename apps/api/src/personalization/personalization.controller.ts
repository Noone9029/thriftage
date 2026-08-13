import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  recommendationEventInputSchema,
  recommendationConfigurationInputSchema,
  styleProfileInputSchema,
  styleQuizCompleteSchema,
  type RecommendationEventInput,
  type RecommendationConfigurationInput,
  type StyleProfileInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PersonalizationService } from './personalization.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());
const styleAdminInput = z.strictObject({
  description: z.string().trim().max(240).nullable().optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

@Controller()
export class PersonalizationController {
  public constructor(
    @Inject(PersonalizationService) private readonly service: PersonalizationService,
  ) {}

  @Get('styles')
  public styles() {
    return this.service.definitions();
  }

  @Get('me/style-profile')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public get(@CurrentUser() user: User) {
    return this.service.get(user.id);
  }

  @Put('me/style-profile')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public save(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(styleProfileInputSchema)) input: StyleProfileInput,
  ) {
    return this.service.save(user.id, input, false);
  }

  @Post('me/style-profile/complete')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public complete(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(styleQuizCompleteSchema)) input: StyleProfileInput,
  ) {
    return this.service.save(user.id, input, true);
  }

  @Delete('me/style-profile')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public reset(@CurrentUser() user: User) {
    return this.service.resetProfile(user.id);
  }

  @Get('me/personalization/privacy')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public privacy(@CurrentUser() user: User) {
    return this.service.privacy(user.id);
  }

  @Delete('me/personalization/learned-signals')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public resetLearned(@CurrentUser() user: User) {
    return this.service.resetLearnedSignals(user.id);
  }

  @Put('listings/:listingId/not-interested')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public hide(@CurrentUser() user: User, @Param('listingId', uuidPipe) listingId: string) {
    return this.service.setNotInterested(user.id, listingId, true);
  }

  @Delete('listings/:listingId/not-interested')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public undoHide(@CurrentUser() user: User, @Param('listingId', uuidPipe) listingId: string) {
    return this.service.setNotInterested(user.id, listingId, false);
  }

  @Post('me/personalization/events')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public event(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(recommendationEventInputSchema)) input: RecommendationEventInput,
  ) {
    return this.service.recordEvent(user.id, input);
  }
}

@Controller('admin/personalization')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class PersonalizationAdminController {
  public constructor(
    @Inject(PersonalizationService) private readonly service: PersonalizationService,
  ) {}

  @Get('summary')
  public summary() {
    return this.service.adminSummary();
  }

  @Get('configuration')
  public configuration() {
    return this.service.configuration();
  }

  @Post('configuration')
  public activateConfiguration(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(recommendationConfigurationInputSchema))
    input: RecommendationConfigurationInput,
  ) {
    return this.service.activateConfiguration(user.id, input);
  }

  @Get('styles')
  public styles() {
    return this.service.definitions(true);
  }

  @Patch('styles/:id')
  public updateStyle(
    @CurrentUser() user: User,
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(styleAdminInput)) input: z.infer<typeof styleAdminInput>,
  ) {
    return this.service.updateDefinition(user.id, id, input);
  }
}
