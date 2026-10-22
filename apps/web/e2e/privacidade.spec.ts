import type { Page } from '@playwright/test';
import { expect, test } from './apoio';

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
  });
});
