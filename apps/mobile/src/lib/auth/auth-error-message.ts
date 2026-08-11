import { ZodError } from 'zod';

import { getMobileApiErrorMessage } from '../api/mobile-api-error';
import { AuthCallbackError } from './deep-link';

export function getMobileAuthErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Check the information you entered.';
  }
  if (error instanceof AuthCallbackError) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      readonly code?: unknown;
      readonly message?: unknown;
      readonly status?: unknown;
    };
    if (candidate.status === 429) {
      return 'Too many attempts. Please wait and try again.';
    }
    if (
      candidate.code === 'invalid_credentials' ||
      (typeof candidate.message === 'string' &&
        /invalid login credentials/i.test(candidate.message))
    ) {
      return 'The email or password is incorrect.';
    }
  }
  return getMobileApiErrorMessage(error);
}
