import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'site',
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'], exclude: ['src/main.tsx', 'src/types/**', 'src/test/**'] },
  },
});
