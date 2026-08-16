import { HttpException, HttpStatus } from '@nestjs/common';
import type { FeedbackErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<
  FeedbackErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  FEEDBACK_GENERATION_NOT_FOUND: {
    message: 'This Stylist response is unavailable.',
    status: HttpStatus.NOT_FOUND,
  },
  FEEDBACK_NOT_FOUND: {
    message: 'Feedback was not found.',
    status: HttpStatus.NOT_FOUND,
  },
  FEEDBACK_RATE_LIMITED: {
    message: 'Too many feedback reports were submitted. Try again later.',
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  FEEDBACK_SERVICE_ERROR: {
    message: 'Feedback is temporarily unavailable.',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  FEEDBACK_TRANSITION_INVALID: {
    message: 'This feedback can no longer be changed.',
    status: HttpStatus.CONFLICT,
  },
  FEEDBACK_VALIDATION_FAILED: {
    message: 'Feedback input is invalid.',
    status: HttpStatus.BAD_REQUEST,
  },
};

export class FeedbackDomainError extends Error {
  public constructor(public readonly code: FeedbackErrorCode) {
    super(code);
  }
}

export class FeedbackApiException extends HttpException {
  public constructor(public readonly code: FeedbackErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapFeedbackError(error: unknown): FeedbackApiException {
  if (error instanceof FeedbackApiException) return error;
  if (error instanceof FeedbackDomainError) return new FeedbackApiException(error.code);
  if (error instanceof ZodError) return new FeedbackApiException('FEEDBACK_VALIDATION_FAILED');
  return new FeedbackApiException('FEEDBACK_SERVICE_ERROR');
}
