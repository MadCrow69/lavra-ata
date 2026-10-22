import type { Page } from '@playwright/test';
import { afirmarLimpo, expect, test } from './apoio';

/** A página não rola na horizontal (a ata ainda não existe, então o auxiliar de cartões não serve). */
async function paginaCabeNaLargura(page: Page) {
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
}

/**
 * "Privacidade: como verificar" contra o build com CSP ativa: o que o modal afirma sobre os hosts
 * permitidos tem de ser o que a CSP do <head> realmente declara, e o modal cabe em 360 px.
 */
test.describe('Privacidade: como verificar', () => {
  test('os hosts do modal são os do connect-src da CSP; Esc devolve o foco; cabe em 360 px', async ({
    app: page,
    rede,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await paginaCabeNaLargura(page);

    const botao = page.getByRole('button', { name: 'Privacidade: como verificar' });
    await botao.click();
    const dialogo = page.getByRole('dialog', { name: 'Privacidade: como verificar' });
    await expect(dialogo).toBeVisible();

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    const connectSrc = /connect-src ([^;]+)/.exec(csp ?? '')?.[1] ?? '';
    const hostsDaCsp = connectSrc.split(' ').map((o) => new URL(o).host);
    expect(hostsDaCsp).toHaveLength(3);
    const secao = dialogo.locator('section', { hasText: 'O que sai do navegador' });
    for (const host of hostsDaCsp) {
      await expect(secao.getByText(host, { exact: true })).toBeVisible();
    }

    // O link do código aponta para a pasta dos adaptadores (o ref depende do build: não se fixa).
    const href = await dialogo
      .getByRole('link', { name: 'Adaptadores de IA (as chamadas aos provedores)' })
      .getAttribute('href');
    // Prefixo literal: `config/site.ts` lê `__COMMIT_SHA__`, que não existe no Node do Playwright.
    expect(href).toMatch(
      /^https:\/\/github\.com\/MadCrow69\/lavra-ata\/tree\/.+\/apps\/web\/src\/ai\/providers$/,
    );

    const medidas = await dialogo.evaluate((el) => ({
      painel: el.scrollWidth - el.clientWidth,
      pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(medidas.painel).toBeLessThanOrEqual(0);
    expect(medidas.pagina).toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(botao).toBeFocused();

    await paginaCabeNaLargura(page);
    await afirmarLimpo(page, rede);
    expect(rede.chamadas).toEqual([]);
  });
});

test.describe('Card de compartilhamento e ícone', () => {
  test('o build serve o ícone, o PNG da tela inicial e a imagem do card, sem violar a CSP', async ({
    app: page,
    rede,
  }) => {
    const icone = await page.locator('link[rel="icon"]').getAttribute('href');
    const iconePng = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    // O Vite acrescenta o `base` aos arquivos de `public/`.
    expect(icone).toBe('/lavra-ata/favicon.svg');
    expect(iconePng).toBe('/lavra-ata/apple-touch-icon.png');
    // A imagem do card tem URL absoluta (o LinkedIn não resolve caminho relativo): o mesmo arquivo
    // é servido pelo build em `og-image.png`.
    const card = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(card).toMatch(/^https:\/\/.+\/og-image\.png$/);
    for (const [caminho, tipo] of [
      ['favicon.svg', 'image/svg+xml'],
      ['apple-touch-icon.png', 'image/png'],
      ['og-image.png', 'image/png'],
    ] as const) {
      const resposta = await page.request.get(caminho);
      expect(resposta.status(), caminho).toBe(200);
      expect(resposta.headers()['content-type'], caminho).toContain(tipo);
    }
    await afirmarLimpo(page, rede);
  });
});
