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
    // Os testes de tela no jsdom levam segundos sob carga (CI, cobertura, 4 workers); com o padrão
    // de 5 s, um corpo assíncrono estourado seguia digitando no DOM do teste seguinte.
    testTimeout: 20_000,
    // O Vitest troca CSS por string vazia (inclusive `?raw`); tokens.css é lido como texto pelo
    // teste que confere as cores do PDF/DOCX contra a folha.
    css: { include: [/styles\/tokens\.css/] },
  },
});
