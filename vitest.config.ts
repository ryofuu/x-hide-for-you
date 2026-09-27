import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    css: true,
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://x.com/home' } },
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    restoreMocks: true,
  },
});
