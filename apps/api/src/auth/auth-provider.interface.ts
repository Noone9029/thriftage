import type { AuthenticatedIdentity, AuthoritativeAuthUser } from './auth.types';

export const AUTH_TOKEN_VERIFIER = Symbol('AUTH_TOKEN_VERIFIER');
export const AUTHORITATIVE_AUTH_USER_PROVIDER = Symbol('AUTHORITATIVE_AUTH_USER_PROVIDER');

export interface AuthTokenVerifier {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity>;
}

export interface AuthoritativeAuthUserProvider {
  getUser(accessToken: string): Promise<AuthoritativeAuthUser>;
}

export type AuthTokenVerificationFailureCode = 'expired' | 'invalid';

export class AuthTokenVerificationError extends Error {
  public constructor(
    public readonly failureCode: AuthTokenVerificationFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthTokenVerificationError';
  }
}
