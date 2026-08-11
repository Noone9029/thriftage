import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@thriftage/config': fileURLToPath(
        new URL('./packages/config/src/index.ts', import.meta.url),
      ),
      '@thriftage/db': fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url)),
      '@thriftage/shared': fileURLToPath(
        new URL('./packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    include: ['apps/**/*.test.ts', 'apps/**/*.spec.ts', 'packages/**/*.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
