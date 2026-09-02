import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { AddressController } from './address.controller';
import { AddressRepository } from './address.repository';
import { AddressService } from './address.service';
import { CashOnDeliveryAdapter } from './cash-on-delivery.adapter';
import { ConfiguredPaymentRouter } from './configured-payment-router';
import { PayFastHostedAdapter } from './payfast-hosted.adapter';
import { AdminOrderController, OrderController } from './order.controller';
import {
  AdminFinanceController,
  RefundController,
  SellerFinanceController,
} from './finance.controller';
import { FinanceService } from './finance.service';
import { PayFastPaymentController } from './payfast-payment.controller';
import { PayFastPaymentService } from './payfast-payment.service';
import { PAYFAST_GATEWAY, type PayFastGateway } from './payfast-gateway.interface';
import { UnavailablePayFastGateway } from './unavailable-payfast-gateway';
import { OrderFinalizationWorker } from './order-finalization.worker';
import { OrderPresenter } from './order.presenter';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { TrustModule } from '../trust/trust.module';
import { PersonalizationModule } from '../personalization/personalization.module';

@Module({
  controllers: [
    AddressController,
    AdminFinanceController,
    AdminOrderController,
    OrderController,
    PayFastPaymentController,
    RefundController,
    SellerFinanceController,
  ],
  exports: [OrderRepository, OrderService],
  imports: [AuthModule, ListingsModule, PersonalizationModule, TrustModule],
  providers: [
    { provide: AddressRepository, useFactory: () => new AddressRepository() },
    AddressService,
    CashOnDeliveryAdapter,
    ConfiguredPaymentRouter,
    { provide: FinanceService, useFactory: () => new FinanceService() },
    PayFastHostedAdapter,
    {
      provide: PayFastPaymentService,
      inject: [PAYFAST_GATEWAY],
      useFactory: (gateway: PayFastGateway) => new PayFastPaymentService(gateway),
    },
    UnavailablePayFastGateway,
    OrderFinalizationWorker,
    OrderPresenter,
    {
      provide: OrderRepository,
      inject: [PAYMENT_PROVIDER],
      useFactory: (provider: CashOnDeliveryAdapter) => new OrderRepository(provider),
    },
    OrderService,
    { provide: PAYMENT_PROVIDER, useExisting: ConfiguredPaymentRouter },
    { provide: PAYFAST_GATEWAY, useExisting: UnavailablePayFastGateway },
  ],
})
export class CommerceModule {}
