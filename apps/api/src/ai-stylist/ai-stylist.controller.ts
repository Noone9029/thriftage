import {
  Body,
  Controller,
  Delete,
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
  aiStylistAttributionInputSchema,
  aiStylistConversationCreateInputSchema,
  aiStylistConversationQuerySchema,
  aiStylistMessageInputSchema,
  cursorPageQuerySchema,
  replaceSavedOutfitItemInputSchema,
  saveOutfitInputSchema,
  type AiStylistAttributionInput,
  type AiStylistConversationCreateInput,
  type AiStylistConversationQuery,
  type AiStylistMessageInput,
  type ReplaceSavedOutfitItemInput,
  type SaveOutfitInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { mapAiStylistError } from './ai-stylist.errors';
import { AiStylistService } from './ai-stylist.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());
const archiveInputSchema = z.strictObject({ archived: z.boolean() });

function mapResult<T>(operation: Promise<T>): Promise<T> {
  return operation.catch((error: unknown) => {
    throw mapAiStylistError(error);
  });
}

@Controller('ai-stylist/conversations')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class AiStylistConversationController {
  public constructor(@Inject(AiStylistService) private readonly service: AiStylistService) {}

  @Post()
  public create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(aiStylistConversationCreateInputSchema))
    input: AiStylistConversationCreateInput,
  ) {
    return mapResult(this.service.createConversation(user.id, input));
  }

  @Get()
  public list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(aiStylistConversationQuerySchema))
    query: AiStylistConversationQuery,
  ) {
    return mapResult(this.service.listConversations(user.id, query));
  }

  @Get(':id')
  public get(@CurrentUser() user: User, @Param('id', uuidPipe) id: string) {
    return mapResult(this.service.conversation(user.id, id));
  }

  @Patch(':id/archive')
  public archive(
    @CurrentUser() user: User,
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(archiveInputSchema)) input: z.infer<typeof archiveInputSchema>,
  ) {
    return mapResult(this.service.archiveConversation(user.id, id, input.archived));
  }

  @Delete(':id')
  public delete(@CurrentUser() user: User, @Param('id', uuidPipe) id: string) {
    return mapResult(this.service.deleteConversation(user.id, id));
  }

  @Post(':id/messages')
  public message(
    @CurrentUser() user: User,
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(aiStylistMessageInputSchema)) input: AiStylistMessageInput,
  ) {
    return mapResult(this.service.generate(user.id, id, input));
  }
}

@Controller('ai-stylist/saved-outfits')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class AiStylistSavedOutfitController {
  public constructor(@Inject(AiStylistService) private readonly service: AiStylistService) {}

  @Post()
  public save(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(saveOutfitInputSchema)) input: SaveOutfitInput,
  ) {
    return mapResult(this.service.saveOutfit(user.id, input));
  }

  @Get()
  public list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: unknown,
  ) {
    return mapResult(this.service.savedOutfits(user.id, query));
  }

  @Get(':id')
  public get(@CurrentUser() user: User, @Param('id', uuidPipe) id: string) {
    return mapResult(this.service.savedOutfit(user.id, id));
  }

  @Delete(':id')
  public delete(@CurrentUser() user: User, @Param('id', uuidPipe) id: string) {
    return mapResult(this.service.deleteSavedOutfit(user.id, id));
  }

  @Post(':id/items/:itemId/replacement')
  public replacement(
    @CurrentUser() user: User,
    @Param('id', uuidPipe) id: string,
    @Param('itemId', uuidPipe) itemId: string,
    @Body(new ZodValidationPipe(replaceSavedOutfitItemInputSchema))
    input: ReplaceSavedOutfitItemInput,
  ) {
    return mapResult(this.service.replaceSavedOutfitItem(user.id, id, itemId, input));
  }
}

@Controller('ai-stylist/attribution')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class AiStylistAttributionController {
  public constructor(@Inject(AiStylistService) private readonly service: AiStylistService) {}

  @Post()
  public record(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(aiStylistAttributionInputSchema)) input: AiStylistAttributionInput,
  ) {
    return mapResult(this.service.recordAttribution(user.id, input));
  }
}

@Controller('admin/ai-stylist')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AiStylistAdminController {
  public constructor(@Inject(AiStylistService) private readonly service: AiStylistService) {}

  @Get('metrics')
  public metrics() {
    return mapResult(this.service.adminMetrics());
  }

  @Get('configuration')
  public configuration() {
    return this.service.runtimeConfiguration();
  }
}
