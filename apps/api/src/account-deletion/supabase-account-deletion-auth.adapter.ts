import { loadApiConfig } from '@thriftage/config/api';
import { createClient } from '@supabase/supabase-js';

import type { AccountDeletionAuthAdmin } from './account-deletion-auth.interface';

interface AuthAdminClient {
  deleteUser(
    id: string,
    shouldSoftDelete?: boolean,
  ): Promise<{
    readonly data: { readonly user: unknown | null };
    readonly error: unknown | null;
  }>;
  signOut(
    jwt: string,
    scope?: 'global' | 'local' | 'others',
  ): Promise<{ readonly data: null; readonly error: unknown | null }>;
}

function isMissingUser(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly status?: unknown;
  };
  return (
    candidate.status === 404 ||
    [candidate.code, candidate.message].some(
      (value) => typeof value === 'string' && /user.*not.*found/i.test(value),
    )
  );
}

export class SupabaseAccountDeletionAuthAdapter implements AccountDeletionAuthAdmin {
  public constructor(private readonly configuredClient?: AuthAdminClient) {}

  private get client(): AuthAdminClient {
    if (this.configuredClient !== undefined) return this.configuredClient;
    const config = loadApiConfig(process.env);
    return createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    }).auth.admin;
  }

  public async revokeSession(accessToken: string): Promise<void> {
    const { error } = await this.client.signOut(accessToken, 'global');
    if (error !== null) throw new Error('AUTH_SESSION_REVOCATION_FAILED');
  }

  public async deleteIdentity(authProviderUserId: string): Promise<void> {
    const { error } = await this.client.deleteUser(authProviderUserId, false);
    if (error !== null && !isMissingUser(error)) throw new Error('AUTH_IDENTITY_DELETION_FAILED');
  }
}
