import { Injectable } from '@nestjs/common';

import type { PushProvider, PushReceipt, PushTicket } from './push-provider.interface';

interface ExpoResponse<T> {
  readonly data: T;
}

@Injectable()
export class ExpoPushAdapter implements PushProvider {
  private headers(): Record<string, string> {
    const token = process.env.EXPO_PUSH_ACCESS_TOKEN;
    return {
      'Content-Type': 'application/json',
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    };
  }
  public async send(input: {
    readonly body: string;
    readonly data: Readonly<Record<string, string>>;
    readonly title: string;
    readonly token: string;
  }): Promise<PushTicket> {
    if (process.env.EXPO_PUSH_ENABLED !== 'true') return { id: `disabled:${input.token}` };
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      body: JSON.stringify({
        body: input.body,
        data: input.data,
        sound: 'default',
        title: input.title,
        to: input.token,
      }),
      headers: this.headers(),
      method: 'POST',
    });
    if (!response.ok) throw new Error(`EXPO_HTTP_${response.status}`);
    const payload = (await response.json()) as ExpoResponse<{
      readonly details?: { readonly error?: string };
      readonly id?: string;
      readonly status: string;
    }>;
    if (payload.data.status !== 'ok' || payload.data.id === undefined)
      throw new Error(payload.data.details?.error ?? 'EXPO_TICKET_ERROR');
    return { id: payload.data.id };
  }
  public async receipts(ticketIds: readonly string[]): Promise<ReadonlyMap<string, PushReceipt>> {
    const result = new Map<string, PushReceipt>();
    const enabledIds = ticketIds.filter((id) => !id.startsWith('disabled:'));
    for (const id of ticketIds.filter((value) => value.startsWith('disabled:')))
      result.set(id, { status: 'ok' });
    if (enabledIds.length === 0) return result;
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      body: JSON.stringify({ ids: enabledIds }),
      headers: this.headers(),
      method: 'POST',
    });
    if (!response.ok) throw new Error(`EXPO_RECEIPT_HTTP_${response.status}`);
    const payload = (await response.json()) as ExpoResponse<
      Record<
        string,
        { readonly details?: { readonly error?: string }; readonly status: 'ok' | 'error' }
      >
    >;
    for (const [id, receipt] of Object.entries(payload.data))
      result.set(id, {
        ...(receipt.details?.error === undefined ? {} : { errorCode: receipt.details.error }),
        status: receipt.status,
      });
    return result;
  }
}
