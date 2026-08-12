import { HttpException, HttpStatus } from '@nestjs/common';
import type { SafetyErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<SafetyErrorCode, { message: string; status: HttpStatus }> = {
  BLOCK_FORBIDDEN: { message: 'This user cannot be blocked.', status: HttpStatus.CONFLICT },
  BLOCK_NOT_FOUND: { message: 'Blocked user not found.', status: HttpStatus.NOT_FOUND },
  INTERACTION_NOT_AVAILABLE: {
    message: 'This marketplace interaction is not available.',
    status: HttpStatus.FORBIDDEN,
  },
  POLICY_ACCEPTANCE_REQUIRED: {
    message: 'Accept the current marketplace policies before continuing.',
    status: HttpStatus.PRECONDITION_REQUIRED,
  },
  POLICY_CONFIGURATION_REQUIRED: {
    message: 'Marketplace policy configuration is incomplete.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  RESTRICTION_NOT_FOUND: { message: 'Restriction not found.', status: HttpStatus.NOT_FOUND },
  ADMIN_USER_NOT_FOUND: { message: 'User not found.', status: HttpStatus.NOT_FOUND },
  SAFETY_SERVICE_ERROR: {
    message: 'Trust and safety services are temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  SAFETY_VALIDATION_FAILED: {
    message: 'Check the trust and safety request.',
    status: HttpStatus.BAD_REQUEST,
  },
};
export class TrustDomainError extends Error {
  public constructor(public readonly code: SafetyErrorCode) {
    super(code);
  }
}
export class TrustApiException extends HttpException {
  public constructor(public readonly code: SafetyErrorCode) {
    const d = definitions[code];
    super({ code, message: d.message, statusCode: d.status }, d.status);
  }
}
export function mapTrustError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  if (error instanceof TrustDomainError) return new TrustApiException(error.code);
  if (error instanceof ZodError) return new TrustApiException('SAFETY_VALIDATION_FAILED');
  return new TrustApiException('SAFETY_SERVICE_ERROR');
}
