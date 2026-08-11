import { HttpException, HttpStatus } from '@nestjs/common';
import type { PhoneVerificationErrorCode } from '@thriftage/shared';

import { AuthApiException } from '../auth/auth.errors';
import { AuthAdminProviderError } from './auth-admin-provider.interface';
import { PhoneVerificationProviderError } from './phone-verification-provider.interface';

export class PhoneVerificationDomainError extends Error {
  public constructor(
    public readonly code: PhoneVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PhoneVerificationDomainError';
  }
}

export interface PhoneVerificationErrorDefinition {
  readonly message: string;
  readonly status: HttpStatus;
}

const errorDefinitions: Record<PhoneVerificationErrorCode, PhoneVerificationErrorDefinition> = {
  PHONE_ALREADY_IN_USE: {
    message: 'This phone number cannot be linked to this account.',
    status: HttpStatus.CONFLICT,
  },
  PHONE_IDENTITY_CONFLICT: {
    message: 'The authentication identity has a conflicting phone number.',
    status: HttpStatus.CONFLICT,
  },
  PHONE_INVALID: {
    message: 'Enter a valid international phone number.',
    status: HttpStatus.BAD_REQUEST,
  },
  PHONE_VERIFICATION_CODE_INVALID: {
    message: 'The verification code is invalid.',
    status: HttpStatus.BAD_REQUEST,
  },
  PHONE_VERIFICATION_EXPIRED: {
    message: 'The phone verification attempt has expired.',
    status: HttpStatus.GONE,
  },
  PHONE_VERIFICATION_NOT_FOUND: {
    message: 'No matching phone verification attempt was found.',
    status: HttpStatus.NOT_FOUND,
  },
  PHONE_VERIFICATION_PROVIDER_ERROR: {
    message: 'Phone verification is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  PHONE_VERIFICATION_RATE_LIMITED: {
    message: 'Too many phone verification attempts. Try again later.',
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
};

export class PhoneVerificationApiException extends HttpException {
  public constructor(public readonly code: PhoneVerificationErrorCode) {
    const definition = errorDefinitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function toPhoneVerificationApiException(error: unknown): HttpException {
  if (error instanceof AuthApiException) return error;
  if (error instanceof PhoneVerificationDomainError) {
    return new PhoneVerificationApiException(error.code);
  }
  if (error instanceof PhoneVerificationProviderError) {
    switch (error.code) {
      case 'EXPIRED':
        return new PhoneVerificationApiException('PHONE_VERIFICATION_EXPIRED');
      case 'RATE_LIMITED':
        return new PhoneVerificationApiException('PHONE_VERIFICATION_RATE_LIMITED');
      case 'PROVIDER_ERROR':
        return new PhoneVerificationApiException('PHONE_VERIFICATION_PROVIDER_ERROR');
    }
  }
  if (error instanceof AuthAdminProviderError) {
    return new PhoneVerificationApiException(
      error.code === 'IDENTITY_MISMATCH'
        ? 'PHONE_IDENTITY_CONFLICT'
        : 'PHONE_VERIFICATION_PROVIDER_ERROR',
    );
  }
  return new PhoneVerificationApiException('PHONE_VERIFICATION_PROVIDER_ERROR');
}
