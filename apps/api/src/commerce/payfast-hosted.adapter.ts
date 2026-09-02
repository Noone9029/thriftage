import { Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';

import type { PaymentProvider, PaymentProviderResult } from './payment-provider.interface';

/**
 * Creates the server-owned payment intent. The provider-specific form/session exchange is kept
 * behind the PayFast routes and remains disabled until the merchant receives its approved
 * marketplace integration pack and sandbox credentials.
 */
@Injectable()
export class PayFastHostedAdapter implements PaymentProvider {
  public createPayment(input: {
    readonly method: 'CASH_ON_DELIVERY' | 'PAYFAST_HOSTED';
    readonly orderId: string;
  }): Promise<PaymentProviderResult> {
    if (input.method !== 'PAYFAST_HOSTED')
      return Promise.reject(new Error('UNSUPPORTED_PAYMENT_METHOD'));
    const config = loadApiConfig(process.env);
    if (!config.payfastEnabled) return Promise.reject(new Error('PAYFAST_DISABLED'));
    return Promise.resolve({
      expiresAt: new Date(Date.now() + config.paymentExpiryMinutes * 60_000),
      provider: 'PAYFAST',
      providerReference: `payfast:pending:${input.orderId}`,
      status: 'REQUIRES_ACTION',
    });
  }

  public collect(input: {
    readonly method: 'CASH_ON_DELIVERY' | 'PAYFAST_HOSTED';
    readonly orderId: string;
  }): Promise<PaymentProviderResult> {
    if (input.method !== 'PAYFAST_HOSTED')
      return Promise.reject(new Error('UNSUPPORTED_PAYMENT_METHOD'));
    return Promise.reject(new Error('PAYFAST_STATUS_MUST_BE_AUTHORITATIVE'));
  }

  public cancel(input: {
    readonly method: 'CASH_ON_DELIVERY' | 'PAYFAST_HOSTED';
    readonly orderId: string;
  }): Promise<PaymentProviderResult> {
    if (input.method !== 'PAYFAST_HOSTED')
      return Promise.reject(new Error('UNSUPPORTED_PAYMENT_METHOD'));
    return Promise.resolve({
      provider: 'PAYFAST',
      providerReference: `payfast:cancelled:${input.orderId}`,
      status: 'CANCELLED',
    });
  }
}
