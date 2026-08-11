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
  listingReportInputSchema,
  moderationReportQuerySchema,
  moderationReportUpdateInputSchema,
  sellerListingQuerySchema,
  userReportInputSchema,
  type AdminListingDetail,
  type ListingPage,
  type ListingReportInput,
  type ModerationReport,
  type ModerationReportQuery,
  type ModerationReportUpdateInput,
  type UserReportInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ModerationService } from './moderation.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('reports')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class ReportController {
  public constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  @Post('listings')
  public reportListing(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(listingReportInputSchema)) input: ListingReportInput,
  ): Promise<ModerationReport> {
    return this.moderation.reportListing(user.id, input);
  }

  @Post('users')
  public reportUser(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(userReportInputSchema)) input: UserReportInput,
  ): Promise<ModerationReport> {
    return this.moderation.reportUser(user.id, input);
  }
}

@Controller('admin')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminModerationController {
  public constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  @Get('listings')
  public listListings(
    @Query(new ZodValidationPipe(sellerListingQuerySchema)) query: unknown,
  ): Promise<ListingPage> {
    return this.moderation.listListings(query);
  }

  @Get('listings/:listingId')
  public getListing(@Param('listingId', uuidPipe) listingId: string): Promise<AdminListingDetail> {
    return this.moderation.getListing(listingId);
  }

  @Post('listings/:listingId/approve')
  public approve(
    @CurrentUser() admin: User,
    @Param('listingId', uuidPipe) listingId: string,
    @Body() input: unknown,
  ): Promise<AdminListingDetail> {
    return this.moderation.moderateListing(admin.id, listingId, 'APPROVE', input);
  }

  @Post('listings/:listingId/reject')
  public reject(
    @CurrentUser() admin: User,
    @Param('listingId', uuidPipe) listingId: string,
    @Body() input: unknown,
  ): Promise<AdminListingDetail> {
    return this.moderation.moderateListing(admin.id, listingId, 'REJECT', input);
  }

  @Post('listings/:listingId/remove')
  public remove(
    @CurrentUser() admin: User,
    @Param('listingId', uuidPipe) listingId: string,
    @Body() input: unknown,
  ): Promise<AdminListingDetail> {
    return this.moderation.moderateListing(admin.id, listingId, 'REMOVE', input);
  }

  @Get('reports')
  public listReports(
    @Query(new ZodValidationPipe(moderationReportQuerySchema)) query: ModerationReportQuery,
  ) {
    return this.moderation.listReports(query);
  }

  @Patch('reports/:reportId')
  public updateReport(
    @CurrentUser() admin: User,
    @Param('reportId', uuidPipe) reportId: string,
    @Body(new ZodValidationPipe(moderationReportUpdateInputSchema))
    input: ModerationReportUpdateInput,
  ): Promise<ModerationReport> {
    return this.moderation.updateReport(admin.id, reportId, input);
  }
}
