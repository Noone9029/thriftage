import 'dotenv/config';

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.trim() === '') {
  throw new Error('TEST_DATABASE_URL is required for web integration tests.');
}

const parsed = new URL(testDatabaseUrl);
const databaseName = parsed.pathname.replace(/^\//, '').toLowerCase();
const localPrismaDev =
  process.env.ALLOW_PRISMA_DEV_TEST_DATABASE === 'true' &&
  ['127.0.0.1', 'localhost'].includes(parsed.hostname) &&
  parsed.port !== '5432';
if (!databaseName.includes('test') && !localPrismaDev) {
  throw new Error(
    'TEST_DATABASE_URL must target a named test database or approved local Prisma Dev.',
  );
}

process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.integration.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
