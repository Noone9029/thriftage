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
  checkoutInputSchema,
  orderCancellationInputSchema,
  type CheckoutInput,
  type OrderCancellationInput,
  type OrderDetail,
  type OrderPage,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrderService } from './order.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('orders')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class OrderController {
  public constructor(@Inject(OrderService) private readonly orders: OrderService) {}
  @Post()
  public place(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(checkoutInputSchema)) input: CheckoutInput,
  ): Promise<OrderDetail> {
    return this.orders.place(user.id, input);
  }
  @Get('purchases')
  public purchases(@CurrentUser() user: User, @Query() query: unknown): Promise<OrderPage> {
    return this.orders.list(user.id, 'buyer', query);
  }
  @Get('sales')
  public sales(@CurrentUser() user: User, @Query() query: unknown): Promise<OrderPage> {
    return this.orders.list(user.id, 'seller', query);
  }
  @Get(':orderId')
  public get(
    @CurrentUser() user: User,
    @Param('orderId', uuidPipe) orderId: string,
  ): Promise<OrderDetail> {
    return this.orders.get(user.id, orderId);
  }
  @Patch(':orderId/confirm')
  public confirm(
    @CurrentUser() user: User,
    @Param('orderId', uuidPipe) orderId: string,
  ): Promise<OrderDetail> {
    return this.orders.confirm(user.id, orderId);
  }
  @Patch(':orderId/cancel-buyer')
  public cancelBuyer(
    @CurrentUser() user: User,
    @Param('orderId', uuidPipe) orderId: string,
    @Body(new ZodValidationPipe(orderCancellationInputSchema)) input: OrderCancellationInput,
  ): Promise<OrderDetail> {
    return this.orders.cancelBuyer(user.id, orderId, input);
  }
  @Patch(':orderId/cancel-seller')
  public cancelSeller(
    @CurrentUser() user: User,
    @Param('orderId', uuidPipe) orderId: string,
    @Body(new ZodValidationPipe(orderCancellationInputSchema)) input: OrderCancellationInput,
  ): Promise<OrderDetail> {
    return this.orders.cancelSeller(user.id, orderId, input);
  }
  @Patch(':orderId/confirm-delivery')
  public delivery(
    @CurrentUser() user: User,
    @Param('orderId', uuidPipe) orderId: string,
  ): Promise<OrderDetail> {
    return this.orders.confirmDelivery(user.id, orderId);
  }
}

@Controller('admin/orders')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminOrderController {
  public constructor(@Inject(OrderService) private readonly orders: OrderService) {}
  @Get()
  public list(@Query() query: unknown): Promise<OrderPage> {
    return this.orders.listAdmin(query);
  }
  @Get(':orderId')
  public get(@Param('orderId', uuidPipe) orderId: string): Promise<OrderDetail> {
    return this.orders.getAdmin(orderId);
  }
}
