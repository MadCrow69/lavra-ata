import { defineConfig, devices } from '@playwright/test';
import { configBase } from './playwright.config';

/** Porta só da gravação (não colide com o E2E, 4391, nem com o `vite preview` padrão, 4173). */
const PORTA_GIF = 4392;
const LARGURA = 1280;
const ALTURA = 720;

const base = configBase(PORTA_GIF);

/**
 * Grava o vídeo da demonstração do README (`pnpm --filter @lavra/web gif`), contra o build com a
 * CSP ativa. Fica fora do `testDir` do E2E (`./e2e`): o CI nunca grava. O vídeo vai para
 * `test-results/gif/` e `scripts/video-para-gif.mjs` o converte em `docs/demo.gif`.
 */
export default defineConfig({
  ...base,
  testDir: './gif',
  outputDir: 'test-results/gif',
  workers: 1,
  reporter: 'list',
  use: {
    ...base.use,
    viewport: { width: LARGURA, height: ALTURA },
    video: { mode: 'on', size: { width: LARGURA, height: ALTURA } },
    // Desacelera cada ação para que o clique seja visível no vídeo.
    launchOptions: { slowMo: 250 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: LARGURA, height: ALTURA } },
    },
  ],
});
