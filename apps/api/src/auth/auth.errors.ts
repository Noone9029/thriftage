import { HttpException, HttpStatus } from '@nestjs/common';
import type { AuthErrorCode } from '@thriftage/shared';

import { AuthTokenVerificationError } from './auth-provider.interface';

const errorDefinitions: Record<
  AuthErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  ACCOUNT_DEACTIVATED: {
    message: 'This account is deactivated.',
    status: HttpStatus.FORBIDDEN,
  },
  ACCOUNT_SUSPENDED: {
    message: 'This account is suspended.',
    status: HttpStatus.FORBIDDEN,
  },
  ADMIN_PERMISSION_DENIED: {
    message: 'Administrator permission is required.',
    status: HttpStatus.FORBIDDEN,
  },
  AUTH_EXPIRED_TOKEN: {
    message: 'The access token has expired.',
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_EMAIL_UNVERIFIED: {
    message: 'Email confirmation is required before account provisioning.',
    status: HttpStatus.FORBIDDEN,
  },
  AUTH_IDENTITY_CONFLICT: {
    message: 'This identity cannot be linked automatically.',
    status: HttpStatus.CONFLICT,
  },
  AUTH_INVALID_TOKEN: {
    message: 'The access token is invalid.',
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_REQUIRED: {
    message: 'Authentication is required.',
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_USER_NOT_PROVISIONED: {
    message: 'The authenticated account has not been provisioned.',
    status: HttpStatus.FORBIDDEN,
  },
};

export class AuthApiException extends HttpException {
  public constructor(public readonly code: AuthErrorCode) {
    const definition = errorDefinitions[code];
    super(
      {
        code,
        message: definition.message,
        statusCode: definition.status,
      },
      definition.status,
    );
  }
}

export function mapTokenVerificationError(error: unknown): AuthApiException {
  if (error instanceof AuthTokenVerificationError && error.failureCode === 'expired') {
    return new AuthApiException('AUTH_EXPIRED_TOKEN');
  }

  return new AuthApiException('AUTH_INVALID_TOKEN');
}
