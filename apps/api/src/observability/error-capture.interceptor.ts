import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { getRequestId } from './request-context';

@Injectable()
export class ErrorCaptureInterceptor implements NestInterceptor {
  public intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        if (status >= 500) {
          Sentry.withScope((scope) => {
            const requestId = getRequestId();
            if (requestId !== undefined) scope.setTag('request_id', requestId);
            scope.setTag('http_status', String(status));
            Sentry.captureException(error);
          });
        }
        throw error;
      }),
    );
  }
}
