import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  sellerVerificationApplyInputSchema,
  sellerVerificationDecisionSchema,
  type SellerVerificationApplyInput,
  type SellerVerificationDecision,
} from '@thriftage/shared';
import { z } from 'zod';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SellerVerificationService } from './seller-verification.service';
@Controller('seller-verification')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class SellerVerificationController {
  constructor(@Inject(SellerVerificationService) private readonly s: SellerVerificationService) {}
  @Get('eligibility') eligibility(@CurrentUser() u: User) {
    return this.s.eligibility(u.id);
  }
  @Get('current') current(@CurrentUser() u: User) {
    return this.s.current(u.id);
  }
  @Post('apply') apply(
    @CurrentUser() u: User,
    @Body(new ZodValidationPipe(sellerVerificationApplyInputSchema))
    i: SellerVerificationApplyInput,
  ) {
    return this.s.apply(u.id, i);
  }
}
@Controller('admin/seller-verification')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminSellerVerificationController {
  constructor(@Inject(SellerVerificationService) private readonly s: SellerVerificationService) {}
  @Get() list(@Query() q: unknown) {
    return this.s.list(q);
  }
  @Post(':id/decision') decide(
    @CurrentUser() a: User,
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @Body(new ZodValidationPipe(sellerVerificationDecisionSchema)) i: SellerVerificationDecision,
  ) {
    return this.s.decide(a.id, id, i);
  }
}
