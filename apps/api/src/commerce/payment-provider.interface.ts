import type {
  CurrencyCode,
  PaymentMethod,
  PaymentProviderCode,
  PaymentStatus,
} from '@thriftage/db';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProviderResult {
  readonly checkoutUrl?: string;
  readonly expiresAt?: Date;
  readonly provider: PaymentProviderCode;
  readonly providerReference: string;
  readonly status: PaymentStatus;
}

export interface PaymentProvider {
  createPayment(input: {
    readonly amountMinor: number;
    readonly currency: CurrencyCode;
    readonly method: PaymentMethod;
    readonly orderId: string;
  }): Promise<PaymentProviderResult>;
  collect(input: {
    readonly method: PaymentMethod;
    readonly paymentId: string;
    readonly orderId: string;
  }): Promise<PaymentProviderResult>;
  cancel(input: {
    readonly method: PaymentMethod;
    readonly paymentId: string;
    readonly orderId: string;
  }): Promise<PaymentProviderResult>;
}
