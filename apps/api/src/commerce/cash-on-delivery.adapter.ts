import { Injectable } from '@nestjs/common';

import type { PaymentProvider, PaymentProviderResult } from './payment-provider.interface';

@Injectable()
export class CashOnDeliveryAdapter implements PaymentProvider {
  public createPayment(input: {
    readonly method: 'CASH_ON_DELIVERY' | 'PAYFAST_HOSTED';
    readonly orderId: string;
  }): Promise<PaymentProviderResult> {
    if (input.method !== 'CASH_ON_DELIVERY')
      return Promise.reject(new Error('UNSUPPORTED_PAYMENT_METHOD'));
    return Promise.resolve({
      provider: 'CASH_ON_DELIVERY',
      providerReference: `cod:${input.orderId}`,
      status: 'PENDING_COLLECTION',
    });
  }
  public collect(input: {
    readonly method: 'CASH_ON_DELIVERY' | 'PAYFAST_HOSTED';
    readonly orderId: string;
  }): Promise<PaymentProviderResult> {
    if (input.method !== 'CASH_ON_DELIVERY')
      return Promise.reject(new Error('UNSUPPORTED_PAYMENT_METHOD'));
    return Promise.resolve({
      provider: 'CASH_ON_DELIVERY',
      providerReference: `cod:${input.orderId}`,
      status: 'COLLECTED',
    });
  }
  public cancel(input: {
    readonly method: 'CASH_ON_DELIVERY' | 'PAYFAST_HOSTED';
    readonly orderId: string;
  }): Promise<PaymentProviderResult> {
    if (input.method !== 'CASH_ON_DELIVERY')
      return Promise.reject(new Error('UNSUPPORTED_PAYMENT_METHOD'));
    return Promise.resolve({
      provider: 'CASH_ON_DELIVERY',
      providerReference: `cod:${input.orderId}`,
      status: 'CANCELLED',
    });
  }
}
