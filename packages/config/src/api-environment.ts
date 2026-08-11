import { parseCommaSeparatedList } from '@thriftage/shared';
import { z } from 'zod';

const apiEnvironmentSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: z.string().optional(),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .regex(/^sb_publishable_[A-Za-z0-9_-]+$/, 'Expected a Supabase publishable key.'),
  SUPABASE_URL: z.string().trim().url(),
});

export interface ApiConfig {
  readonly corsOrigins: readonly string[];
  readonly host: string;
  readonly logFormat: 'json' | 'pretty';
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = apiEnvironmentSchema.parse(environment);

  return Object.freeze({
    corsOrigins: parseCommaSeparatedList(parsed.CORS_ORIGINS),
    host: parsed.API_HOST,
    logFormat: parsed.LOG_FORMAT,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.API_PORT,
    supabasePublishableKey: parsed.SUPABASE_PUBLISHABLE_KEY,
    supabaseUrl: parsed.SUPABASE_URL.replace(/\/$/, ''),
  });
}
