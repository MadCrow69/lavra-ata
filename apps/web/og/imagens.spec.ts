import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EXEMPLOS_E2E,
  ROTULOS_TIPO,
  afirmarLimpo,
  expect,
  folha,
  test,
  verExemplo,
} from '../e2e/apoio';

/**
 * Imagens públicas geradas do app (`pnpm --filter @lavra/web og`, ver `playwright.og.config.ts`).
 * `src/config/compartilhamento.test.ts` confere tamanho, dimensões e as tags do `index.html`.
 */

const DESTINO_OG = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const FAVICON = fileURLToPath(new URL('../public/favicon.svg', import.meta.url));
const DESTINO_ICONE = fileURLToPath(new URL('../public/apple-touch-icon.png', import.meta.url));
/** Lado do ícone da tela inicial do iOS. */
const LADO_ICONE = 180;

test('card de compartilhamento: o exemplo corporativo aberto, com a logo', async ({
  app: page,
  rede,
}) => {
  await verExemplo(page, ROTULOS_TIPO.corporativa);
  await expect(folha(page)).toContainText(EXEMPLOS_E2E.corporativa.organizacao);
  await expect(folha(page).getByRole('img', { name: 'Logo da organização' })).toBeVisible();
  // Sem notificação nem anel de foco na imagem.
  for (const fechar of await page.getByRole('button', { name: 'Fechar notificação' }).all()) {
    await fechar.click();
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({ path: DESTINO_OG, animations: 'disabled', caret: 'hide' });
  await afirmarLimpo(page, rede);
  expect(rede.chamadas).toEqual([]);
});

test('ícone PNG da tela inicial, desenhado do favicon.svg', async ({ page }) => {
  const svg = readFileSync(FAVICON, 'utf-8');
  // O iOS preenche a transparência de preto: o fundo é a cor do próprio quadrado do ícone.
  const fundo = /fill="(#[0-9a-f]{6})"/i.exec(svg)?.[1] ?? '';
  expect(fundo).not.toBe('');
  await page.setViewportSize({ width: LADO_ICONE, height: LADO_ICONE });
  await page.setContent(
    `<body style="margin:0;background:${fundo}">${svg.replace('<svg ', `<svg width="${String(LADO_ICONE)}" height="${String(LADO_ICONE)}" style="display:block" `)}</body>`,
  );
  await page.screenshot({ path: DESTINO_ICONE });
});
