export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

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
