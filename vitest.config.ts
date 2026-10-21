import { defineConfig } from 'vitest/config';

// Em modo `projects` só a configuração de cobertura da raiz vale (e o CI roda `pnpm test:ci`
// aqui): o limite de cada pacote mora neste arquivo, como chave glob.
const LIMITE_95 = { lines: 95, branches: 95, functions: 95, statements: 95 } as const;

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      // Explícito: arquivo do pacote que nenhum teste importa também entra na conta.
      include: ['packages/pii-br/src/**/*.ts'],
      thresholds: {
        'packages/pii-br/src/**': LIMITE_95,
      },
    },
  },
});
