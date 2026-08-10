import { parseCommaSeparatedList } from '@thriftage/shared';
import { z } from 'zod';

const apiEnvironmentSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: z.string().optional(),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export interface ApiConfig {
  readonly corsOrigins: readonly string[];
  readonly host: string;
  readonly logFormat: 'json' | 'pretty';
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = apiEnvironmentSchema.parse(environment);

  return Object.freeze({
    corsOrigins: parseCommaSeparatedList(parsed.CORS_ORIGINS),
    host: parsed.API_HOST,
    logFormat: parsed.LOG_FORMAT,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.API_PORT,
  });
}
