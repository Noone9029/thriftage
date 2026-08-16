export const ACCOUNT_DELETION_AUTH_ADMIN = Symbol('ACCOUNT_DELETION_AUTH_ADMIN');

export interface AccountDeletionAuthAdmin {
  deleteIdentity(authProviderUserId: string): Promise<void>;
  revokeSession(accessToken: string): Promise<void>;
}
