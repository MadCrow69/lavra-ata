import { defineConfig, devices } from '@playwright/test';

/** Porta fixa só do E2E (não colide com o `vite preview` padrão, 4173). */
const PORTA = 4391;
const ORIGEM = `http://127.0.0.1:${String(PORTA)}`;

/**
 * E2E contra o BUILD servido por `vite preview`, onde a CSP está ativa (o dev server não a injeta).
 * Rode `pnpm build` antes. O Playwright sobe o preview e o encerra ao final.
 */
export default defineConfig({
  testDir: './e2e',
  // Um worker: o preview é único e a máquina (ou o runner) é compartilhada.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // A barra final faz `goto('./')` resolver dentro de `base: '/lavra-ata/'`.
    baseURL: `${ORIGEM}/lavra-ata/`,
    serviceWorkers: 'block',
    // O cenário de volume cola a transcrição pela área de transferência (Ctrl+V), como a pessoa.
    permissions: ['clipboard-read', 'clipboard-write'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${String(PORTA)} --strictPort`,
    url: `${ORIGEM}/lavra-ata/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
