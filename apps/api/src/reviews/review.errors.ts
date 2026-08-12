import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
type Code =
  | 'REVIEW_NOT_FOUND'
  | 'REVIEW_NOT_ELIGIBLE'
  | 'REVIEW_ALREADY_SUBMITTED'
  | 'REVIEW_REPORT_DUPLICATE'
  | 'REVIEW_VALIDATION_FAILED'
  | 'REVIEW_SERVICE_ERROR';
const d: Record<Code, { status: HttpStatus; message: string }> = {
  REVIEW_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Review not found.' },
  REVIEW_NOT_ELIGIBLE: {
    status: HttpStatus.CONFLICT,
    message: 'This transaction is not eligible for review.',
  },
  REVIEW_ALREADY_SUBMITTED: {
    status: HttpStatus.CONFLICT,
    message: 'This transaction has already been reviewed.',
  },
  REVIEW_REPORT_DUPLICATE: {
    status: HttpStatus.CONFLICT,
    message: 'You already reported this review.',
  },
  REVIEW_VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Check the review request.',
  },
  REVIEW_SERVICE_ERROR: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Reviews are temporarily unavailable.',
  },
};
export class ReviewDomainError extends Error {
  constructor(public readonly code: Code) {
    super(code);
  }
}
export function mapReviewError(e: unknown): HttpException {
  if (e instanceof HttpException) return e;
  if (e instanceof ReviewDomainError) {
    const x = d[e.code];
    return new HttpException({ code: e.code, message: x.message, statusCode: x.status }, x.status);
  }
  if (e instanceof ZodError) {
    const x = d.REVIEW_VALIDATION_FAILED;
    return new HttpException(
      { code: 'REVIEW_VALIDATION_FAILED', message: x.message, statusCode: x.status },
      x.status,
    );
  }
  return new HttpException(
    { code: 'REVIEW_SERVICE_ERROR', message: d.REVIEW_SERVICE_ERROR.message, statusCode: 503 },
    503,
  );
}
