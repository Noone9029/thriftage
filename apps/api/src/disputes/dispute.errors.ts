import { HttpException, type HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
type Code =
  | 'DISPUTE_NOT_FOUND'
  | 'DISPUTE_NOT_ELIGIBLE'
  | 'DISPUTE_ALREADY_EXISTS'
  | 'DISPUTE_TRANSITION_INVALID'
  | 'DISPUTE_EVIDENCE_LIMIT'
  | 'DISPUTE_SERVICE_ERROR'
  | 'DISPUTE_VALIDATION_FAILED';
const s: Record<Code, HttpStatus> = {
  DISPUTE_NOT_FOUND: 404,
  DISPUTE_NOT_ELIGIBLE: 409,
  DISPUTE_ALREADY_EXISTS: 409,
  DISPUTE_TRANSITION_INVALID: 409,
  DISPUTE_EVIDENCE_LIMIT: 409,
  DISPUTE_SERVICE_ERROR: 503,
  DISPUTE_VALIDATION_FAILED: 400,
};
export class DisputeDomainError extends Error {
  constructor(public readonly code: Code) {
    super(code);
  }
}
export function mapDisputeError(e: unknown) {
  if (e instanceof HttpException) return e;
  const code =
    e instanceof DisputeDomainError
      ? e.code
      : e instanceof ZodError
        ? 'DISPUTE_VALIDATION_FAILED'
        : 'DISPUTE_SERVICE_ERROR';
  return new HttpException(
    { code, message: code.replaceAll('_', ' ').toLowerCase(), statusCode: s[code] },
    s[code],
  );
}
