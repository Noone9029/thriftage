import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  reviewAdminActionSchema,
  reviewCreateInputSchema,
  reviewReportInputSchema,
  type ReviewAdminAction,
  type ReviewCreateInput,
  type ReviewReportInput,
} from '@thriftage/shared';
import { z } from 'zod';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReviewService } from './review.service';
const uuid = new ZodValidationPipe(z.string().uuid());
@Controller()
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly service: ReviewService) {}
  @Get('reviews/orders/:orderId/eligibility') eligibility(
    @CurrentUser() u: User,
    @Param('orderId', uuid) id: string,
  ) {
    return this.service.eligibility(u.id, id);
  }
  @Post('reviews') create(
    @CurrentUser() u: User,
    @Body(new ZodValidationPipe(reviewCreateInputSchema)) i: ReviewCreateInput,
  ) {
    return this.service.create(u.id, i);
  }
  @Get('users/:username/reviews') list(@Param('username') username: string, @Query() q: unknown) {
    return this.service.list(username, q);
  }
  @Post('reviews/:id/reports') report(
    @CurrentUser() u: User,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(reviewReportInputSchema)) i: ReviewReportInput,
  ) {
    return this.service.report(u.id, id, i);
  }
}
@Controller('admin/reviews')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminReviewController {
  constructor(@Inject(ReviewService) private readonly service: ReviewService) {}
  @Get('reports') reports(@Query() q: unknown) {
    return this.service.reports(q);
  }
  @Post(':id/moderate') moderate(
    @CurrentUser() a: User,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(reviewAdminActionSchema)) i: ReviewAdminAction,
  ) {
    return this.service.moderate(a.id, id, i);
  }
}
