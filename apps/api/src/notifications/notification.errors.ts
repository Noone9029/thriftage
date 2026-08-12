import { HttpException, HttpStatus } from '@nestjs/common';
import type { NotificationErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const statuses: Record<NotificationErrorCode, HttpStatus> = {
  NOTIFICATION_DEVICE_INVALID: HttpStatus.BAD_REQUEST,
  NOTIFICATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOTIFICATION_SERVICE_ERROR: HttpStatus.SERVICE_UNAVAILABLE,
};
export class NotificationDomainError extends Error {
  public constructor(public readonly code: NotificationErrorCode) {
    super(code);
  }
}
export function mapNotificationError(error: unknown): HttpException {
  const code: NotificationErrorCode =
    error instanceof NotificationDomainError
      ? error.code
      : error instanceof ZodError
        ? 'NOTIFICATION_DEVICE_INVALID'
        : 'NOTIFICATION_SERVICE_ERROR';
  return new HttpException(
    {
      code,
      message:
        code === 'NOTIFICATION_NOT_FOUND'
          ? 'Notification not found.'
          : code === 'NOTIFICATION_DEVICE_INVALID'
            ? 'Push device is invalid.'
            : 'Notifications are temporarily unavailable.',
      statusCode: statuses[code],
    },
    statuses[code],
  );
}
