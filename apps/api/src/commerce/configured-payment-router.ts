import { Inject, Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';

import { CashOnDeliveryAdapter } from './cash-on-delivery.adapter';
import { PayFastHostedAdapter } from './payfast-hosted.adapter';
import type { PaymentProvider, PaymentProviderResult } from './payment-provider.interface';

@Injectable()
export class ConfiguredPaymentRouter implements PaymentProvider {
  public constructor(
    @Inject(CashOnDeliveryAdapter)
    private readonly cashOnDelivery: CashOnDeliveryAdapter,
    @Inject(PayFastHostedAdapter)
    private readonly payfast: PayFastHostedAdapter,
  ) {}

  public createPayment(
    input: Parameters<PaymentProvider['createPayment']>[0],
  ): Promise<PaymentProviderResult> {
    const config = loadApiConfig(process.env);
    if (input.method === 'CASH_ON_DELIVERY') {
      if (!config.codEnabled) return Promise.reject(new Error('COD_DISABLED'));
      return this.cashOnDelivery.createPayment(input);
    }
    if (!config.payfastEnabled) return Promise.reject(new Error('PAYFAST_DISABLED'));
    return this.payfast.createPayment(input);
  }

  public collect(input: Parameters<PaymentProvider['collect']>[0]): Promise<PaymentProviderResult> {
    return input.method === 'CASH_ON_DELIVERY'
      ? this.cashOnDelivery.collect(input)
      : this.payfast.collect(input);
  }

  public cancel(input: Parameters<PaymentProvider['cancel']>[0]): Promise<PaymentProviderResult> {
    return input.method === 'CASH_ON_DELIVERY'
      ? this.cashOnDelivery.cancel(input)
      : this.payfast.cancel(input);
  }
}
