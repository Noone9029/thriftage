import type { CurrencyCode, PaymentStatus } from '@thriftage/db';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProviderResult {
  readonly provider: 'CASH_ON_DELIVERY';
  readonly providerReference: string;
  readonly status: PaymentStatus;
}

export interface PaymentProvider {
  createPayment(input: {
    readonly amountMinor: number;
    readonly currency: CurrencyCode;
    readonly orderId: string;
  }): Promise<PaymentProviderResult>;
  collect(input: {
    readonly paymentId: string;
    readonly orderId: string;
  }): Promise<PaymentProviderResult>;
  cancel(input: {
    readonly paymentId: string;
    readonly orderId: string;
  }): Promise<PaymentProviderResult>;
}
