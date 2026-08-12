import { z } from 'zod';

const mobileEnvironmentSchema = z.strictObject({
  apiUrl: z.string().trim().url(),
  supportUrl: z.string().trim().url().optional(),
  supabasePublishableKey: z
    .string()
    .trim()
    .regex(/^sb_publishable_[A-Za-z0-9_-]+$/, 'Expected a Supabase publishable key.'),
  supabaseUrl: z.string().trim().url(),
});

export interface MobileConfig {
  readonly apiUrl: string;
  readonly supportUrl?: string;
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
}

export function loadMobileConfig(environment: {
  readonly apiUrl: string | undefined;
  readonly supportUrl?: string | undefined;
  readonly supabasePublishableKey: string | undefined;
  readonly supabaseUrl: string | undefined;
}): MobileConfig {
  const parsed = mobileEnvironmentSchema.parse(environment);
  return Object.freeze({
    apiUrl: parsed.apiUrl.replace(/\/$/, ''),
    ...(parsed.supportUrl === undefined
      ? {}
      : { supportUrl: parsed.supportUrl.replace(/\/$/, '') }),
    supabasePublishableKey: parsed.supabasePublishableKey,
    supabaseUrl: parsed.supabaseUrl.replace(/\/$/, ''),
  });
}
