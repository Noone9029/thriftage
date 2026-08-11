import {
  apiErrorCodeSchema,
  phoneVerificationErrorCodeSchema,
  profileErrorCodeSchema,
  type AuthErrorCode,
  type PhoneVerificationErrorCode,
  type ProfileErrorCode,
} from '@thriftage/shared';
import { z } from 'zod';

export type MobileApiErrorCode =
  AuthErrorCode | PhoneVerificationErrorCode | ProfileErrorCode | 'VALIDATION_FAILED' | 'API_ERROR';

const mobileApiErrorCodeSchema = z.union([
  apiErrorCodeSchema,
  phoneVerificationErrorCodeSchema,
  profileErrorCodeSchema,
]);

export class MobileApiError extends Error {
  public constructor(
    public readonly code: MobileApiErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

export async function decodeApiError(response: Response): Promise<MobileApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const parsedCode = mobileApiErrorCodeSchema.safeParse(body.code);
    if (parsedCode.success) {
      return new MobileApiError(parsedCode.data, 'Authentication request failed.', response.status);
    }
  }
  return new MobileApiError('API_ERROR', 'The Thriftage service is unavailable.', response.status);
}

const userMessages: Record<MobileApiErrorCode, string> = {
  ACCOUNT_DEACTIVATED: 'This Thriftage account is deactivated. You can still sign out.',
  ACCOUNT_SUSPENDED: 'This Thriftage account is suspended. You can still sign out.',
  ADMIN_PERMISSION_DENIED: 'This action requires an administrator account.',
  API_ERROR: 'Something went wrong. Check your connection and try again.',
  AUTH_EXPIRED_TOKEN: 'Your session expired. Please sign in again.',
  AUTH_EMAIL_UNVERIFIED: 'Confirm your email before completing your Thriftage account.',
  AUTH_IDENTITY_CONFLICT: 'This email or phone is already linked to another Thriftage account.',
  AUTH_INVALID_TOKEN: 'Your session is no longer valid. Please sign in again.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  AUTH_USER_NOT_PROVISIONED: 'Complete your account to continue.',
  PHONE_ALREADY_IN_USE: 'That phone number is already linked to another account.',
  PHONE_IDENTITY_CONFLICT: 'That phone conflicts with the existing account identity.',
  PHONE_INVALID: 'Enter a valid phone number with country code.',
  PHONE_VERIFICATION_CODE_INVALID: 'That verification code is incorrect.',
  PHONE_VERIFICATION_EXPIRED: 'That verification code has expired. Request a new one.',
  PHONE_VERIFICATION_NOT_FOUND: 'No active phone verification was found.',
  PHONE_VERIFICATION_PROVIDER_ERROR: 'Phone verification is temporarily unavailable.',
  PHONE_VERIFICATION_RATE_LIMITED: 'Too many verification attempts. Please wait and retry.',
  PROFILE_ALREADY_EXISTS: 'Your profile is already complete.',
  PROFILE_IMAGE_INVALID: 'Choose a valid JPEG, PNG, or WebP image.',
  PROFILE_IMAGE_STORAGE_ERROR: 'Profile image storage is temporarily unavailable.',
  PROFILE_IMAGE_TOO_LARGE: 'Profile images must be no larger than 5 MB.',
  PROFILE_NOT_FOUND: 'Complete your public profile to continue.',
  PROFILE_SERVICE_ERROR: 'Profiles are temporarily unavailable.',
  PROFILE_VALIDATION_FAILED: 'Check your profile information and try again.',
  USERNAME_UNAVAILABLE: 'That username is already taken.',
  VALIDATION_FAILED: 'Check the information you entered.',
};

export function getMobileApiErrorMessage(error: unknown): string {
  if (error instanceof MobileApiError) {
    return userMessages[error.code];
  }
  return 'Something went wrong. Please try again.';
}
