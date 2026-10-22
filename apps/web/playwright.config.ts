import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/** Porta fixa só do E2E (não colide com o `vite preview` padrão, 4173). */
const PORTA_E2E = 4391;

/**
 * O que o E2E e a gravação do GIF (`playwright.gif.config.ts`) compartilham: o `vite preview` do
 * BUILD (onde a CSP está ativa; o dev server não a injeta), o `baseURL` e o `use` comuns. Rode
 * `pnpm build` antes. O Playwright sobe o preview na `porta` e o encerra ao final.
 */
export function configBase(porta: number) {
  const origem = `http://127.0.0.1:${String(porta)}`;
  return {
    // Um worker: o preview é único e a máquina (ou o runner) é compartilhada.
    workers: 1,
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
      // A barra final faz `goto('./')` resolver dentro de `base: '/lavra-ata/'`.
      baseURL: `${origem}/lavra-ata/`,
      serviceWorkers: 'block',
      // O cenário de volume cola a transcrição pela área de transferência (Ctrl+V), como a pessoa.
      permissions: ['clipboard-read', 'clipboard-write'],
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      actionTimeout: 10_000,
    },
    webServer: {
      command: `pnpm exec vite preview --host 127.0.0.1 --port ${String(porta)} --strictPort`,
      url: `${origem}/lavra-ata/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  } satisfies PlaywrightTestConfig;
}

const base = configBase(PORTA_E2E);

export default defineConfig({
  ...base,
  testDir: './e2e',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { ...base.use, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
