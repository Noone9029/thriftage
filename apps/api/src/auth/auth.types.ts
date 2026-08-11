import type { User } from '@thriftage/db';

export interface AuthenticatedIdentity {
  readonly assuranceLevel: 'aal1' | 'aal2' | null;
  readonly authProviderUserId: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly sessionId: string | null;
}

export interface AuthenticatedRequestContext {
  readonly accessToken: string;
  readonly identity: AuthenticatedIdentity;
}

export interface AuthoritativeAuthUser {
  readonly authProviderUserId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly phone: string | null;
  readonly phoneVerified: boolean;
}

export interface AuthenticatedHttpRequest {
  readonly headers: {
    readonly authorization?: string | readonly string[];
  };
  authContext?: AuthenticatedRequestContext;
  currentUser?: User;
}
