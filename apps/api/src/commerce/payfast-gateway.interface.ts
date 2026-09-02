import type { CurrencyCode } from '@thriftage/db';

export const PAYFAST_GATEWAY = Symbol('PAYFAST_GATEWAY');

export type PayFastAuthoritativeStatus = 'CANCELLED' | 'FAILED' | 'PAID' | 'PENDING';

export interface PayFastGatewayEvent {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly eventId: string;
  readonly orderId: string;
  readonly providerReference: string;
  readonly status: PayFastAuthoritativeStatus;
}

export interface PayFastHostedSession {
  readonly expiresAt: Date;
  /**
   * Direct hosted-checkout or server-owned form-handoff URL. It must not contain customer PII,
   * provider secrets, or unsigned client-calculated money fields.
   */
  readonly redirectUrl: string;
  /** Stable provider-side session/payment identifier used for recovery and callback matching. */
  readonly providerReference: string;
}

export interface PayFastGateway {
  createHostedSession(input: {
    readonly amountMinor: number;
    readonly currency: CurrencyCode;
    readonly customerEmail: string;
    readonly customerPhone: string;
    /** Provider calls must use this value to make repeated checkout requests idempotent. */
    readonly idempotencyKey: string;
    readonly orderId: string;
  }): Promise<PayFastHostedSession>;
  getAuthoritativeStatus(providerReference: string): Promise<PayFastGatewayEvent>;
  verifyCallback(rawBody: Buffer, signature: string): Promise<PayFastGatewayEvent>;
}
