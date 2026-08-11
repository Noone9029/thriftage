import { Controller, Delete, Get, Inject, Param, Put, Query, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  cursorPageQuerySchema,
  usernameSchema,
  type ListingPage,
  type SellerProfileWithListings,
  type SocialActionResult,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser, OptionalCurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { OptionalAuthenticationGuard } from '../auth/optional-authentication.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SocialService } from './social.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller()
export class SocialController {
  public constructor(@Inject(SocialService) private readonly social: SocialService) {}

  @Put('listings/:listingId/like')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public like(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
  ): Promise<SocialActionResult> {
    return this.social.setLike(user.id, listingId, true);
  }

  @Delete('listings/:listingId/like')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public unlike(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
  ): Promise<SocialActionResult> {
    return this.social.setLike(user.id, listingId, false);
  }

  @Put('listings/:listingId/save')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public save(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
  ): Promise<SocialActionResult> {
    return this.social.setSaved(user.id, listingId, true);
  }

  @Delete('listings/:listingId/save')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public unsave(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
  ): Promise<SocialActionResult> {
    return this.social.setSaved(user.id, listingId, false);
  }

  @Put('sellers/:userId/follow')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public follow(
    @CurrentUser() user: User,
    @Param('userId', uuidPipe) targetUserId: string,
  ): Promise<SocialActionResult> {
    return this.social.setFollow(user.id, targetUserId, true);
  }

  @Delete('sellers/:userId/follow')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public unfollow(
    @CurrentUser() user: User,
    @Param('userId', uuidPipe) targetUserId: string,
  ): Promise<SocialActionResult> {
    return this.social.setFollow(user.id, targetUserId, false);
  }

  @Get('sellers/:username')
  @UseGuards(OptionalAuthenticationGuard)
  public getSeller(
    @OptionalCurrentUser() viewer: User | undefined,
    @Param('username', new ZodValidationPipe(usernameSchema)) username: string,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: unknown,
  ): Promise<SellerProfileWithListings> {
    return this.social.getSeller(username, query, viewer?.id);
  }

  @Get('me/saved-listings')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public listSaved(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: unknown,
  ): Promise<ListingPage> {
    return this.social.listSaved(user.id, query);
  }
}
