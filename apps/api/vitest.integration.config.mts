import 'dotenv/config';

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.trim() === '') {
  throw new Error('TEST_DATABASE_URL is required for API integration tests.');
}

const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
const databaseName = parsedTestDatabaseUrl.pathname.replace(/^\//, '');
const isNamedTestDatabase = databaseName.toLowerCase().includes('test');
const isExplicitLocalPrismaDevDatabase =
  process.env.ALLOW_PRISMA_DEV_TEST_DATABASE === 'true' &&
  ['127.0.0.1', 'localhost'].includes(parsedTestDatabaseUrl.hostname) &&
  parsedTestDatabaseUrl.port !== '5432';

if (!isNamedTestDatabase && !isExplicitLocalPrismaDevDatabase) {
  throw new Error(
    'TEST_DATABASE_URL must target a database whose name contains "test" or an explicitly allowed local Prisma Dev port.',
  );
}

process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: {
    alias: {
      '@thriftage/config/api': fileURLToPath(
        new URL('../../packages/config/src/api-environment.ts', import.meta.url),
      ),
      '@thriftage/db': fileURLToPath(new URL('../../packages/db/src/index.ts', import.meta.url)),
      '@thriftage/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.integration.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
