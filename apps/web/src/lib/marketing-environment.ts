import { z } from 'zod';

const marketingEnvironmentSchema = z.strictObject({
  DATABASE_URL: z.string().trim().min(1),
  MARKETING_FORM_HASH_SECRET: z.string().min(32),
});

export function parseMarketingEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return marketingEnvironmentSchema.safeParse({
    DATABASE_URL: environment.DATABASE_URL,
    MARKETING_FORM_HASH_SECRET: environment.MARKETING_FORM_HASH_SECRET,
  });
}
