import { describe, expect, it } from 'vitest';

import { createPrismaClient } from './client';

describe('createPrismaClient', () => {
  const databaseUrl = 'postgresql://user:password@localhost:5432/thriftage_test';

  it.each([0, 1.5, 101])('rejects unsafe pool maximum %s', (max) => {
    expect(() => createPrismaClient(databaseUrl, { max })).toThrow(
      'Database pool max must be an integer between 1 and 100.',
    );
  });
});
