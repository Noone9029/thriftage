import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  payoutBatchCreateInputSchema,
  payoutBatchPaidInputSchema,
  payoutProfileReviewInputSchema,
  refundDecisionInputSchema,
  refundRequestInputSchema,
  sellerPayoutProfileInputSchema,
  settlementInputSchema,
  commerceMetricsQuerySchema,
  type PayoutBatchCreateInput,
  type PayoutBatchPaidInput,
  type PayoutProfileReviewInput,
  type RefundDecisionInput,
  type RefundRequestInput,
  type SellerPayoutProfileInput,
  type SettlementInput,
  type CommerceMetricsQuery,
  adminShipmentInputSchema,
  type AdminShipmentInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentAuthContext, CurrentUser } from '../auth/current-auth.decorators';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FinanceService } from './finance.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('seller/finance')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class SellerFinanceController {
  public constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get('payout-profiles')
  public profiles(@CurrentUser() user: User) {
    return this.finance.listPayoutProfiles(user.id);
  }

  @Post('payout-profiles')
  public createProfile(
    @CurrentUser() user: User,
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(sellerPayoutProfileInputSchema)) input: SellerPayoutProfileInput,
  ) {
    return this.finance.createPayoutProfile(user, context, input);
  }

  @Get('statement')
  public statement(@CurrentUser() user: User) {
    return this.finance.sellerStatement(user.id);
  }
}

@Controller('orders/:orderId/refunds')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class RefundController {
  public constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Post()
  public request(
    @CurrentUser() user: User,
    @Param('orderId', uuidPipe) orderId: string,
    @Body(new ZodValidationPipe(refundRequestInputSchema)) input: RefundRequestInput,
  ) {
    return this.finance.requestRefund(user.id, orderId, input);
  }
}

@Controller('admin/finance')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminFinanceController {
  public constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Post('settlements')
  public settlement(
    @CurrentUser() admin: User,
    @Body(new ZodValidationPipe(settlementInputSchema)) input: SettlementInput,
  ) {
    return this.finance.recordSettlement(admin.id, input);
  }

  @Post('shipments/:orderId')
  public shipment(
    @CurrentUser() admin: User,
    @Param('orderId', uuidPipe) orderId: string,
    @Body(new ZodValidationPipe(adminShipmentInputSchema)) input: AdminShipmentInput,
  ) {
    return this.finance.updateShipment(admin.id, orderId, input);
  }

  @Get('metrics')
  public metrics(
    @CurrentUser() admin: User,
    @Query(new ZodValidationPipe(commerceMetricsQuerySchema)) query: CommerceMetricsQuery,
  ) {
    return this.finance.metrics(admin.id, query);
  }

  @Get('metrics.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  public metricsCsv(
    @CurrentUser() admin: User,
    @Query(new ZodValidationPipe(commerceMetricsQuerySchema)) query: CommerceMetricsQuery,
  ) {
    return this.finance.metricsCsv(admin.id, query);
  }

  @Get('sellers')
  public sellers(@CurrentUser() admin: User) {
    return this.finance.sellerInventory(admin.id);
  }

  @Post('payout-profiles/:profileId/review')
  public reviewProfile(
    @CurrentUser() admin: User,
    @Param('profileId', uuidPipe) profileId: string,
    @Body(new ZodValidationPipe(payoutProfileReviewInputSchema)) input: PayoutProfileReviewInput,
  ) {
    return this.finance.reviewPayoutProfile(admin.id, profileId, input);
  }

  @Post('refunds/:refundId/decision')
  public refundDecision(
    @CurrentUser() admin: User,
    @Param('refundId', uuidPipe) refundId: string,
    @Body(new ZodValidationPipe(refundDecisionInputSchema)) input: RefundDecisionInput,
  ) {
    return this.finance.decideRefund(admin.id, refundId, input);
  }

  @Post('refunds/:refundId/succeeded')
  public refundSucceeded(
    @CurrentUser() admin: User,
    @Param('refundId', uuidPipe) refundId: string,
    @Body(
      new ZodValidationPipe(
        z.strictObject({ providerReference: z.string().trim().min(1).max(255) }),
      ),
    )
    input: { providerReference: string },
  ) {
    return this.finance.recordRefundSucceeded(admin.id, refundId, input.providerReference);
  }

  @Post('refunds/:refundId/restore-stock')
  public restoreStock(
    @CurrentUser() admin: User,
    @Param('refundId', uuidPipe) refundId: string,
    @Body(
      new ZodValidationPipe(
        z.strictObject({ evidenceReference: z.string().trim().min(1).max(255) }),
      ),
    )
    input: { evidenceReference: string },
  ) {
    return this.finance.restoreRefundedStock(admin.id, refundId, input.evidenceReference);
  }

  @Post('payout-batches')
  public payoutBatch(
    @CurrentUser() admin: User,
    @Body(new ZodValidationPipe(payoutBatchCreateInputSchema)) input: PayoutBatchCreateInput,
  ) {
    return this.finance.createPayoutBatch(admin.id, input);
  }

  @Post('payout-batches/:batchId/approve')
  public approveBatch(@CurrentUser() admin: User, @Param('batchId', uuidPipe) batchId: string) {
    return this.finance.approvePayoutBatch(admin.id, batchId);
  }

  @Post('payout-batches/:batchId/paid')
  public paidBatch(
    @CurrentUser() admin: User,
    @Param('batchId', uuidPipe) batchId: string,
    @Body(new ZodValidationPipe(payoutBatchPaidInputSchema)) input: PayoutBatchPaidInput,
  ) {
    return this.finance.recordPayoutBatchPaid(admin.id, batchId, input);
  }
}
