import { HttpException, HttpStatus } from '@nestjs/common';
import type { ProfileErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<
  ProfileErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  PROFILE_ALREADY_EXISTS: {
    message: 'This account already has a profile.',
    status: HttpStatus.CONFLICT,
  },
  PROFILE_IMAGE_INVALID: {
    message: 'Upload a valid JPEG, PNG, or WebP profile image.',
    status: HttpStatus.BAD_REQUEST,
  },
  PROFILE_IMAGE_STORAGE_ERROR: {
    message: 'Profile image storage is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  PROFILE_IMAGE_TOO_LARGE: {
    message: 'Profile images must be no larger than 5 MB.',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
  },
  PROFILE_SERVICE_ERROR: {
    message: 'Profile service is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  PROFILE_NOT_FOUND: {
    message: 'The requested profile was not found.',
    status: HttpStatus.NOT_FOUND,
  },
  PROFILE_VALIDATION_FAILED: {
    message: 'Profile validation failed.',
    status: HttpStatus.BAD_REQUEST,
  },
  USERNAME_UNAVAILABLE: {
    message: 'This username is unavailable.',
    status: HttpStatus.CONFLICT,
  },
};

export class ProfileDomainError extends Error {
  public constructor(public readonly code: ProfileErrorCode) {
    super(code);
    this.name = 'ProfileDomainError';
  }
}

export class ProfileApiException extends HttpException {
  public constructor(public readonly code: ProfileErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapProfileError(error: unknown): ProfileApiException {
  if (error instanceof ProfileDomainError) return new ProfileApiException(error.code);
  if (error instanceof ZodError) return new ProfileApiException('PROFILE_VALIDATION_FAILED');
  return new ProfileApiException('PROFILE_SERVICE_ERROR');
}
