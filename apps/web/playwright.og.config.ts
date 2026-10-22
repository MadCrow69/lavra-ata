import { defineConfig, devices } from '@playwright/test';
import { configBase } from './playwright.config';

/** Porta só desta geração (não colide com o E2E, 4391, o GIF, 4392, nem o `vite preview`, 4173). */
const PORTA_OG = 4393;
/** Tamanho recomendado do card Open Graph (LinkedIn e afins). */
const LARGURA = 1200;
const ALTURA = 630;

const base = configBase(PORTA_OG);

/**
 * Gera a imagem do card de compartilhamento (`public/og-image.png`) e o ícone PNG
 * (`public/apple-touch-icon.png`) a partir do app real, contra o build com a CSP ativa
 * (`pnpm build && pnpm --filter @lavra/web og`). Fica fora do `testDir` do E2E (`./e2e`): o CI
 * nunca gera. Depois de gerar, rode `pnpm build` de novo para a imagem entrar no `dist/`.
 */
export default defineConfig({
  ...base,
  testDir: './og',
  outputDir: 'test-results/og',
  reporter: 'list',
  use: { ...base.use, viewport: { width: LARGURA, height: ALTURA } },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: LARGURA, height: ALTURA },
        deviceScaleFactor: 1,
      },
    },
  ],
});
