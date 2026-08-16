import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';

import { runWithRequestContext } from './request-context';

interface RequestLike {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly method: string;
  readonly originalUrl?: string;
  readonly url?: string;
}

interface ResponseLike {
  readonly statusCode: number;
  once(event: 'finish', listener: () => void): void;
  setHeader(name: string, value: string): void;
}

const logger = new Logger('HttpRequest');
const validRequestId = /^[A-Za-z0-9._-]{1,128}$/;

function requestIdFromHeader(value: string | readonly string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && validRequestId.test(candidate) ? candidate : randomUUID();
}

function safePath(request: RequestLike): string {
  return (request.originalUrl ?? request.url ?? '/').split(/[?#]/, 1)[0] ?? '/';
}

export function requestLoggingMiddleware(
  request: RequestLike,
  response: ResponseLike,
  next: () => void,
): void {
  const startedAt = performance.now();
  const requestId = requestIdFromHeader(request.headers['x-request-id']);
  response.setHeader('x-request-id', requestId);

  runWithRequestContext(requestId, () => {
    response.once('finish', () => {
      logger.log(
        JSON.stringify({
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          event: 'http_request_completed',
          method: request.method,
          path: safePath(request),
          requestId,
          statusCode: response.statusCode,
        }),
      );
    });
    next();
  });
}
