import { loadApiConfig } from '@thriftage/config/api';
import { createClient } from '@supabase/supabase-js';
import { phoneNumberSchema } from '@thriftage/shared';
import { z } from 'zod';

import {
  AuthAdminProviderError,
  type AuthAdminProvider,
  type AuthAdminUser,
} from './auth-admin-provider.interface';

export interface SupabaseAuthAdminClient {
  getUserById(authProviderUserId: string): Promise<unknown>;
  updateUserById(
    authProviderUserId: string,
    attributes: { readonly phone: string; readonly phone_confirm: true },
  ): Promise<unknown>;
}

const responseSchema = z.object({
  data: z.object({
    user: z
      .object({
        id: z.string(),
        phone: z.string().nullish(),
        phone_confirmed_at: z.string().nullish(),
      })
      .nullable(),
  }),
  error: z.unknown().nullable(),
});

function parseResponse(response: unknown, expectedId: string): AuthAdminUser {
  const parsed = responseSchema.safeParse(response);
  if (!parsed.success || parsed.data.error !== null || parsed.data.data.user === null) {
    throw new AuthAdminProviderError('PROVIDER_ERROR');
  }
  const user = parsed.data.data.user;
  if (user.id !== expectedId) {
    throw new AuthAdminProviderError('IDENTITY_MISMATCH');
  }
  const phone = user.phone == null ? null : phoneNumberSchema.safeParse(user.phone);
  if (phone !== null && !phone.success) {
    throw new AuthAdminProviderError('PROVIDER_ERROR');
  }
  return Object.freeze({
    authProviderUserId: user.id,
    phone: phone === null ? null : phone.data,
    phoneVerified: user.phone_confirmed_at != null,
  });
}

export class SupabaseAuthAdminAdapter implements AuthAdminProvider {
  public constructor(private readonly configuredClient?: SupabaseAuthAdminClient) {}

  private getClient(): SupabaseAuthAdminClient {
    if (this.configuredClient !== undefined) return this.configuredClient;
    const config = loadApiConfig(process.env);
    return createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    }).auth.admin;
  }

  public async getUserById(authProviderUserId: string): Promise<AuthAdminUser> {
    try {
      return parseResponse(
        await this.getClient().getUserById(authProviderUserId),
        authProviderUserId,
      );
    } catch (error: unknown) {
      if (error instanceof AuthAdminProviderError) throw error;
      throw new AuthAdminProviderError('PROVIDER_ERROR');
    }
  }

  public async setVerifiedPhone(authProviderUserId: string, phone: string): Promise<AuthAdminUser> {
    try {
      return parseResponse(
        await this.getClient().updateUserById(authProviderUserId, {
          phone,
          phone_confirm: true,
        }),
        authProviderUserId,
      );
    } catch (error: unknown) {
      if (error instanceof AuthAdminProviderError) throw error;
      throw new AuthAdminProviderError('PROVIDER_ERROR');
    }
  }
}

export function createSupabaseAuthAdminAdapter(): SupabaseAuthAdminAdapter {
  return new SupabaseAuthAdminAdapter();
}
