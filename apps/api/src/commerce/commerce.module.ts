import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { AddressController } from './address.controller';
import { AddressRepository } from './address.repository';
import { AddressService } from './address.service';
import { CashOnDeliveryAdapter } from './cash-on-delivery.adapter';
import { AdminOrderController, OrderController } from './order.controller';
import { OrderFinalizationWorker } from './order-finalization.worker';
import { OrderPresenter } from './order.presenter';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { TrustModule } from '../trust/trust.module';
import { PersonalizationModule } from '../personalization/personalization.module';

@Module({
  controllers: [AddressController, AdminOrderController, OrderController],
  exports: [OrderRepository, OrderService],
  imports: [AuthModule, ListingsModule, PersonalizationModule, TrustModule],
  providers: [
    { provide: AddressRepository, useFactory: () => new AddressRepository() },
    AddressService,
    CashOnDeliveryAdapter,
    OrderFinalizationWorker,
    OrderPresenter,
    {
      provide: OrderRepository,
      inject: [PAYMENT_PROVIDER],
      useFactory: (provider: CashOnDeliveryAdapter) => new OrderRepository(provider),
    },
    OrderService,
    { provide: PAYMENT_PROVIDER, useExisting: CashOnDeliveryAdapter },
  ],
})
export class CommerceModule {}
