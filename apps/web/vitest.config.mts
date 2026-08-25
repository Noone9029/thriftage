import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/*.integration.test.ts'],
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
