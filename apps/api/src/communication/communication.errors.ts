import { HttpException, HttpStatus } from '@nestjs/common';
import type { CommunicationErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<
  CommunicationErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  CONVERSATION_FORBIDDEN: {
    message: 'You cannot access this conversation.',
    status: HttpStatus.FORBIDDEN,
  },
  CONVERSATION_NOT_FOUND: { message: 'Conversation not found.', status: HttpStatus.NOT_FOUND },
  MESSAGE_CONTACT_SHARING_BLOCKED: {
    message: 'Keep communication inside Thriftage for your protection.',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
  },
  MESSAGE_FLAG_NOT_FOUND: {
    message: 'Message moderation flag not found.',
    status: HttpStatus.NOT_FOUND,
  },
  MESSAGE_INVALID: { message: 'Check the message content.', status: HttpStatus.BAD_REQUEST },
  MESSAGE_RATE_LIMITED: {
    message: 'Please wait before sending another message.',
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  MESSAGING_SERVICE_ERROR: {
    message: 'Messaging is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
};

export class CommunicationDomainError extends Error {
  public constructor(public readonly code: CommunicationErrorCode) {
    super(code);
    this.name = 'CommunicationDomainError';
  }
}

export class CommunicationApiException extends HttpException {
  public constructor(public readonly code: CommunicationErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapCommunicationError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  if (error instanceof CommunicationApiException) return error;
  if (error instanceof CommunicationDomainError) return new CommunicationApiException(error.code);
  if (error instanceof ZodError) return new CommunicationApiException('MESSAGE_INVALID');
  return new CommunicationApiException('MESSAGING_SERVICE_ERROR');
}
