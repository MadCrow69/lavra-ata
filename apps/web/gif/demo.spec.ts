import {
  CPF,
  ROTULOS_TIPO,
  afirmarLimpo,
  baixar,
  expect,
  folha,
  test,
  verExemplo,
} from '../e2e/apoio';

/**
 * Roteiro do GIF do README (`pnpm --filter @lavra/web gif`): modo exemplo → prévia de privacidade
 * lado a lado → PDF baixado. Roda contra o build com a CSP ativa e, como o E2E, termina provando
 * que nada saiu para os provedores nem violou a CSP. Não roda no CI (fora do `testDir` do E2E).
 */

/** Pausas para quem assiste ler cada momento (o `slowMo` da config já desacelera os cliques). */
const PAUSA_ABERTURA_MS = 1_000;
const PAUSA_FOLHA_MS = 1_500;
const PAUSA_LADO_A_LADO_MS = 2_500;
const PAUSA_PDF_MS = 1_500;

test('demonstração: exemplo, o que vai para a IA e PDF', async ({ app: page, rede }) => {
  await page.waitForTimeout(PAUSA_ABERTURA_MS);

  await verExemplo(page, ROTULOS_TIPO.corporativa);
  await expect(folha(page)).toContainText('Exemplo Tecnologia Ltda.');
  await page.waitForTimeout(PAUSA_FOLHA_MS);

  // No desktop o formulário ("Editar") fica ao lado da folha: o botão está na própria tela.
  const verPrevia = page.getByRole('button', { name: 'Ver o que vai para a IA' });
  await verPrevia.scrollIntoViewIfNeeded();
  await expect(verPrevia).toBeVisible();
  await verPrevia.click();
  const dialogo = page.getByRole('dialog', { name: 'O que vai para a IA' });
  // Cada coluna rola até o primeiro dado protegido: o CPF à esquerda, o marcador à direita.
  const original = dialogo.getByRole('region', { name: 'Original', exact: true });
  const enviado = dialogo.getByRole('region', { name: 'Enviado à IA', exact: true });
  await expect(original).toContainText(CPF);
  await expect(enviado).toContainText('[CPF_1]');
  await expect(enviado).not.toContainText(CPF);
  await original.locator('mark').first().scrollIntoViewIfNeeded();
  await enviado.locator('mark').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(PAUSA_LADO_A_LADO_MS);
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();

  const pdf = await baixar(page, 'Baixar PDF');
  expect(pdf.nome).toBe('ata-corporativa-2026-10-14.pdf');
  await expect(page.getByText('PDF baixado')).toBeVisible();
  await page.waitForTimeout(PAUSA_PDF_MS);

  await afirmarLimpo(page, rede);
  expect(rede.chamadas).toEqual([]);
});
