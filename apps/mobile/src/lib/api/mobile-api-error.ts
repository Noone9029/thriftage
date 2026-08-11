import { authErrorCodeSchema, type AuthErrorCode } from '@thriftage/shared';

export type MobileApiErrorCode = AuthErrorCode | 'API_ERROR';

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
    const parsedCode = authErrorCodeSchema.safeParse(body.code);
    if (parsedCode.success) {
      return new MobileApiError(parsedCode.data, 'Authentication request failed.', response.status);
    }
  }
  return new MobileApiError('API_ERROR', 'The Thriftage service is unavailable.', response.status);
}

const userMessages: Record<MobileApiErrorCode, string> = {
  ACCOUNT_DEACTIVATED: 'This Thriftage account is deactivated. You can still sign out.',
  ACCOUNT_SUSPENDED: 'This Thriftage account is suspended. You can still sign out.',
  API_ERROR: 'Something went wrong. Check your connection and try again.',
  AUTH_EXPIRED_TOKEN: 'Your session expired. Please sign in again.',
  AUTH_IDENTITY_CONFLICT: 'This email or phone is already linked to another Thriftage account.',
  AUTH_INVALID_TOKEN: 'Your session is no longer valid. Please sign in again.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  AUTH_USER_NOT_PROVISIONED: 'Complete your account to continue.',
};

export function getMobileApiErrorMessage(error: unknown): string {
  if (error instanceof MobileApiError) {
    return userMessages[error.code];
  }
  return 'Something went wrong. Please try again.';
}
