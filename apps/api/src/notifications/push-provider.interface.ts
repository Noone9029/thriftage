export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export type PushProviderErrorCode =
  | 'PUSH_DEVICE_UNREGISTERED'
  | 'PUSH_PROVIDER_UNAVAILABLE'
  | 'PUSH_RECEIPT_PROVIDER_UNAVAILABLE'
  | 'PUSH_SEND_REJECTED';

export class PushProviderError extends Error {
  public constructor(public readonly code: PushProviderErrorCode) {
    super(code);
    this.name = 'PushProviderError';
  }
}

export interface PushTicket {
  readonly id: string;
}
export interface PushReceipt {
  readonly errorCode?: string;
  readonly status: 'ok' | 'error';
}
export interface PushProvider {
  send(input: {
    readonly body: string;
    readonly data: Readonly<Record<string, string>>;
    readonly title: string;
    readonly token: string;
  }): Promise<PushTicket>;
  receipts(ticketIds: readonly string[]): Promise<ReadonlyMap<string, PushReceipt>>;
}
