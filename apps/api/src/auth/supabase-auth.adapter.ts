import { loadApiConfig } from '@thriftage/config/api';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  AuthTokenVerificationError,
  type AuthoritativeAuthUserProvider,
  type AuthTokenVerifier,
} from './auth-provider.interface';
import type { AuthenticatedIdentity, AuthoritativeAuthUser } from './auth.types';

export interface SupabaseAuthClient {
  getClaims(accessToken: string): Promise<unknown>;
  getUser(accessToken: string): Promise<unknown>;
}

const claimsResponseSchema = z.object({
  data: z
    .object({
      claims: z.record(z.string(), z.unknown()),
    })
    .nullable(),
  error: z.unknown().nullable(),
});

const verifiedClaimsSchema = z.object({
  aal: z.enum(['aal1', 'aal2']).optional(),
  aud: z.union([z.string(), z.array(z.string())]),
  email: z.string().optional(),
  exp: z.number().int(),
  is_anonymous: z.boolean(),
  iss: z.string(),
  phone: z.string().optional(),
  role: z.string(),
  session_id: z.string().optional(),
  sub: z.string(),
});

const userResponseSchema = z.object({
  data: z.object({
    user: z
      .object({
        email: z.string().nullish(),
        email_confirmed_at: z.string().nullish(),
        id: z.string(),
        is_anonymous: z.boolean().optional(),
        phone: z.string().nullish(),
        phone_confirmed_at: z.string().nullish(),
      })
      .nullable(),
  }),
  error: z.unknown().nullable(),
});

interface AdapterRuntime {
  readonly client: SupabaseAuthClient;
  readonly expectedIssuer: string;
}

function optionalNonblank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

function isExpiredProviderError(error: unknown): boolean {
  if (typeof error === 'string') {
    return /expir/i.test(error);
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { readonly code?: unknown; readonly message?: unknown };
  return [candidate.code, candidate.message].some(
    (value) => typeof value === 'string' && /expir/i.test(value),
  );
}

function invalidToken(): AuthTokenVerificationError {
  return new AuthTokenVerificationError('invalid', 'Supabase rejected the access token.');
}

export class SupabaseAuthAdapter implements AuthTokenVerifier, AuthoritativeAuthUserProvider {
  private runtime: AdapterRuntime | undefined;

  public constructor(client?: SupabaseAuthClient, expectedIssuer?: string) {
    if (client !== undefined && expectedIssuer !== undefined) {
      this.runtime = {
        client,
        expectedIssuer: expectedIssuer.replace(/\/$/, ''),
      };
    }
  }

  public async verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity> {
    let rawResponse: unknown;
    try {
      rawResponse = await this.getRuntime().client.getClaims(accessToken);
    } catch (error: unknown) {
      if (isExpiredProviderError(error)) {
        throw new AuthTokenVerificationError('expired', 'Supabase reported an expired token.');
      }
      throw invalidToken();
    }

    const response = claimsResponseSchema.safeParse(rawResponse);
    if (!response.success) {
      throw invalidToken();
    }
    if (response.data.error !== null) {
      if (isExpiredProviderError(response.data.error)) {
        throw new AuthTokenVerificationError('expired', 'Supabase reported an expired token.');
      }
      throw invalidToken();
    }
    if (response.data.data === null) {
      throw invalidToken();
    }

    const parsedClaims = verifiedClaimsSchema.safeParse(response.data.data.claims);
    if (!parsedClaims.success) {
      throw invalidToken();
    }

    const claims = parsedClaims.data;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const isExpired = claims.exp <= Math.floor(Date.now() / 1_000);
    if (isExpired) {
      throw new AuthTokenVerificationError('expired', 'The verified token has expired.');
    }

    const subject = claims.sub.trim();
    if (
      subject === '' ||
      claims.iss.replace(/\/$/, '') !== this.getRuntime().expectedIssuer ||
      !audience.includes('authenticated') ||
      claims.role !== 'authenticated' ||
      claims.is_anonymous
    ) {
      throw invalidToken();
    }

    return Object.freeze({
      assuranceLevel: claims.aal ?? null,
      authProviderUserId: subject,
      email: optionalNonblank(claims.email),
      phone: optionalNonblank(claims.phone),
      sessionId: optionalNonblank(claims.session_id),
    });
  }

  public async getUser(accessToken: string): Promise<AuthoritativeAuthUser> {
    let rawResponse: unknown;
    try {
      rawResponse = await this.getRuntime().client.getUser(accessToken);
    } catch (error: unknown) {
      if (isExpiredProviderError(error)) {
        throw new AuthTokenVerificationError('expired', 'Supabase reported an expired token.');
      }
      throw invalidToken();
    }

    const response = userResponseSchema.safeParse(rawResponse);
    if (response.success && response.data.error !== null) {
      if (isExpiredProviderError(response.data.error)) {
        throw new AuthTokenVerificationError('expired', 'Supabase reported an expired token.');
      }
      throw invalidToken();
    }
    if (
      !response.success ||
      response.data.data.user === null ||
      response.data.data.user.is_anonymous === true
    ) {
      throw invalidToken();
    }

    const user = response.data.data.user;
    const authProviderUserId = user.id.trim();
    if (authProviderUserId === '') {
      throw invalidToken();
    }

    return Object.freeze({
      authProviderUserId,
      email: optionalNonblank(user.email),
      emailVerified: optionalNonblank(user.email_confirmed_at) !== null,
      phone: optionalNonblank(user.phone),
      phoneVerified: optionalNonblank(user.phone_confirmed_at) !== null,
    });
  }

  private getRuntime(): AdapterRuntime {
    if (this.runtime === undefined) {
      const config = loadApiConfig(process.env);
      const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      });
      this.runtime = {
        client: client.auth,
        expectedIssuer: `${config.supabaseUrl}/auth/v1`,
      };
    }

    return this.runtime;
  }
}
