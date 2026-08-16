import { HttpException, HttpStatus } from '@nestjs/common';

export type AccountDeletionErrorCode =
  | 'ACCOUNT_DELETION_ACTIVE_COMMERCE'
  | 'ACCOUNT_DELETION_ACTIVE_DISPUTE'
  | 'ACCOUNT_DELETION_ADMIN_UNSUPPORTED'
  | 'ACCOUNT_DELETION_DISABLED'
  | 'ACCOUNT_DELETION_NOT_FOUND'
  | 'ACCOUNT_DELETION_REAUTH_REQUIRED'
  | 'ACCOUNT_DELETION_SERVICE_ERROR';

const definitions: Record<
  AccountDeletionErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  ACCOUNT_DELETION_ACTIVE_COMMERCE: {
    message: 'Complete or cancel active purchases and sales before deleting this account.',
    status: HttpStatus.CONFLICT,
  },
  ACCOUNT_DELETION_ACTIVE_DISPUTE: {
    message: 'Resolve active disputes before deleting this account.',
    status: HttpStatus.CONFLICT,
  },
  ACCOUNT_DELETION_ADMIN_UNSUPPORTED: {
    message: 'Administrator accounts require an audited role handoff before deletion.',
    status: HttpStatus.CONFLICT,
  },
  ACCOUNT_DELETION_DISABLED: {
    message: 'Account deletion is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  ACCOUNT_DELETION_NOT_FOUND: {
    message: 'No account deletion request was found.',
    status: HttpStatus.NOT_FOUND,
  },
  ACCOUNT_DELETION_REAUTH_REQUIRED: {
    message: 'Sign in again before confirming account deletion.',
    status: HttpStatus.FORBIDDEN,
  },
  ACCOUNT_DELETION_SERVICE_ERROR: {
    message: 'Account deletion could not be requested safely.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
};

export class AccountDeletionDomainError extends Error {
  public constructor(public readonly code: AccountDeletionErrorCode) {
    super(code);
    this.name = 'AccountDeletionDomainError';
  }
}

export class AccountDeletionApiException extends HttpException {
  public constructor(public readonly code: AccountDeletionErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapAccountDeletionError(error: unknown): AccountDeletionApiException {
  if (error instanceof AccountDeletionApiException) return error;
  if (error instanceof AccountDeletionDomainError)
    return new AccountDeletionApiException(error.code);
  return new AccountDeletionApiException('ACCOUNT_DELETION_SERVICE_ERROR');
}
