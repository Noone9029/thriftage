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
  listingDraftInputSchema,
  listingSearchQuerySchema,
  listingUpdateInputSchema,
  sellerListingQuerySchema,
  type ListingDetail,
  type ListingDraftInput,
  type ListingPage,
  type ListingSearchQuery,
  type ListingUpdateInput,
  type SellerListingQuery,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser, OptionalCurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { OptionalAuthenticationGuard } from '../auth/optional-authentication.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ListingService } from './listing.service';

const listingIdPipe = new ZodValidationPipe(z.string().uuid());

@Controller('listings')
export class PublicListingController {
  public constructor(@Inject(ListingService) private readonly listings: ListingService) {}

  @Get()
  @UseGuards(OptionalAuthenticationGuard)
  public search(
    @OptionalCurrentUser() viewer: User | undefined,
    @Query(new ZodValidationPipe(listingSearchQuerySchema)) query: ListingSearchQuery,
  ): Promise<ListingPage> {
    return this.listings.search(query, viewer?.id);
  }

  @Get(':listingId')
  @UseGuards(OptionalAuthenticationGuard)
  public getPublic(
    @OptionalCurrentUser() viewer: User | undefined,
    @Param('listingId', listingIdPipe) listingId: string,
  ): Promise<ListingDetail> {
    return this.listings.getPublic(listingId, viewer?.id);
  }

  @Get(':listingId/similar')
  @UseGuards(OptionalAuthenticationGuard)
  public similar(
    @OptionalCurrentUser() viewer: User | undefined,
    @Param('listingId', listingIdPipe) listingId: string,
  ): Promise<ListingPage> {
    return this.listings.similar(listingId, viewer?.id);
  }
}

@Controller('seller/listings')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class SellerListingController {
  public constructor(@Inject(ListingService) private readonly listings: ListingService) {}

  @Get()
  public listMine(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(sellerListingQuerySchema)) query: SellerListingQuery,
  ): Promise<ListingPage> {
    return this.listings.listMine(user.id, query);
  }

  @Post()
  public create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(listingDraftInputSchema)) input: ListingDraftInput,
  ): Promise<ListingDetail> {
    return this.listings.create(user.id, input);
  }

  @Get(':listingId')
  public getMine(
    @CurrentUser() user: User,
    @Param('listingId', listingIdPipe) listingId: string,
  ): Promise<ListingDetail> {
    return this.listings.getMine(user.id, listingId);
  }

  @Patch(':listingId')
  public update(
    @CurrentUser() user: User,
    @Param('listingId', listingIdPipe) listingId: string,
    @Body(new ZodValidationPipe(listingUpdateInputSchema)) input: ListingUpdateInput,
  ): Promise<ListingDetail> {
    return this.listings.update(user.id, listingId, input);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  public deleteDraft(
    @CurrentUser() user: User,
    @Param('listingId', listingIdPipe) listingId: string,
  ): Promise<void> {
    return this.listings.deleteDraft(user.id, listingId);
  }

  @Post(':listingId/submit')
  public submit(
    @CurrentUser() user: User,
    @Param('listingId', listingIdPipe) listingId: string,
  ): Promise<ListingDetail> {
    return this.listings.submit(user.id, listingId);
  }

  @Post(':listingId/archive')
  public archive(
    @CurrentUser() user: User,
    @Param('listingId', listingIdPipe) listingId: string,
  ): Promise<ListingDetail> {
    return this.listings.archive(user.id, listingId);
  }
}
