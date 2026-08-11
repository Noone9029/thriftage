import type { z } from 'zod';

import { MarketplaceDomainError } from './marketplace.errors';

export function encodeCursor<T>(value: T): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T>(cursor: string | undefined, schema: z.ZodType<T>): T | null {
  if (cursor === undefined) return null;
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new MarketplaceDomainError('VALIDATION_FAILED');
  }
}
