import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Fixo em 'dev' para o teste não depender do GITHUB_SHA do CI.
  define: { __COMMIT_SHA__: JSON.stringify('dev') },
  test: {
    name: '@lavra/web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
