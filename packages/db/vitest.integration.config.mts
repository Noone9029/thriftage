import 'dotenv/config';

import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.trim() === '') {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
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

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['test/**/*.integration.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
