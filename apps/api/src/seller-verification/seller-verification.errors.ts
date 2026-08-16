import { HttpException, HttpStatus } from '@nestjs/common';
import type { SellerVerificationErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';
const map: Record<SellerVerificationErrorCode, HttpStatus> = {
  VERIFICATION_NOT_ELIGIBLE: HttpStatus.CONFLICT,
  VERIFICATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  VERIFICATION_ALREADY_ACTIVE: HttpStatus.CONFLICT,
  VERIFICATION_DISABLED: HttpStatus.SERVICE_UNAVAILABLE,
  VERIFICATION_REAPPLY_LATER: HttpStatus.TOO_MANY_REQUESTS,
  VERIFICATION_SERVICE_ERROR: HttpStatus.SERVICE_UNAVAILABLE,
  VERIFICATION_VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
};
export class SellerVerificationError extends Error {
  constructor(public readonly code: SellerVerificationErrorCode) {
    super(code);
  }
}
export function mapSellerVerificationError(e: unknown) {
  if (e instanceof HttpException) return e;
  const code =
    e instanceof SellerVerificationError
      ? e.code
      : e instanceof ZodError
        ? 'VERIFICATION_VALIDATION_FAILED'
        : 'VERIFICATION_SERVICE_ERROR';
  return new HttpException(
    { code, message: code.replaceAll('_', ' ').toLowerCase(), statusCode: map[code] },
    map[code],
  );
}
