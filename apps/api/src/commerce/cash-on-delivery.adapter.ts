import { Injectable } from '@nestjs/common';

import type { PaymentProvider, PaymentProviderResult } from './payment-provider.interface';

@Injectable()
export class CashOnDeliveryAdapter implements PaymentProvider {
  public createPayment(input: { readonly orderId: string }): Promise<PaymentProviderResult> {
    return Promise.resolve({
      provider: 'CASH_ON_DELIVERY',
      providerReference: `cod:${input.orderId}`,
      status: 'PENDING_COLLECTION',
    });
  }
  public collect(input: { readonly orderId: string }): Promise<PaymentProviderResult> {
    return Promise.resolve({
      provider: 'CASH_ON_DELIVERY',
      providerReference: `cod:${input.orderId}`,
      status: 'COLLECTED',
    });
  }
  public cancel(input: { readonly orderId: string }): Promise<PaymentProviderResult> {
    return Promise.resolve({
      provider: 'CASH_ON_DELIVERY',
      providerReference: `cod:${input.orderId}`,
      status: 'CANCELLED',
    });
  }
}
