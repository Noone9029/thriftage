import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  readonly requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(requestId: string, callback: () => T): T {
  return storage.run({ requestId }, callback);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
