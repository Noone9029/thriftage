import { Controller, Get, Headers, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommerceDomainError, mapCommerceError } from './commerce.errors';
import { PayFastPaymentService } from './payfast-payment.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('payments/payfast')
export class PayFastPaymentController {
  public constructor(
    @Inject(PayFastPaymentService) private readonly payments: PayFastPaymentService,
  ) {}

  @Post('callback')
  public async callback(
    @Req() request: { readonly rawBody?: Buffer },
    @Headers('x-payfast-signature') signature?: string,
  ) {
    try {
      if (request.rawBody === undefined || signature === undefined)
        throw new CommerceDomainError('PAYMENT_SIGNATURE_INVALID');
      await this.payments.callback(request.rawBody, signature);
      return { received: true };
    } catch (error) {
      throw mapCommerceError(error);
    }
  }

  @Post(':orderId/checkout')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public checkout(@CurrentUser() user: User, @Param('orderId', uuidPipe) orderId: string) {
    return this.payments.checkout(user.id, orderId).catch((error) => {
      throw mapCommerceError(error);
    });
  }

  @Get(':orderId/status')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public status(@CurrentUser() user: User, @Param('orderId', uuidPipe) orderId: string) {
    return this.payments.status(user.id, orderId).catch((error) => {
      throw mapCommerceError(error);
    });
  }
}
