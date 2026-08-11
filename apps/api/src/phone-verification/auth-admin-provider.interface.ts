export const AUTH_ADMIN_PROVIDER = Symbol('AUTH_ADMIN_PROVIDER');

export interface AuthAdminUser {
  readonly authProviderUserId: string;
  readonly phone: string | null;
  readonly phoneVerified: boolean;
}

export interface AuthAdminProvider {
  getUserById(authProviderUserId: string): Promise<AuthAdminUser>;
  setVerifiedPhone(authProviderUserId: string, phone: string): Promise<AuthAdminUser>;
}

export type AuthAdminProviderFailureCode = 'IDENTITY_MISMATCH' | 'PROVIDER_ERROR';

export class AuthAdminProviderError extends Error {
  public constructor(public readonly code: AuthAdminProviderFailureCode) {
    super('Authentication administration request failed.');
    this.name = 'AuthAdminProviderError';
  }
}
