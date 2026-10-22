import type { Page } from '@playwright/test';
import {
  CHAVE_OPENAI,
  CPF,
  EXEMPLOS_E2E,
  FRASE_BANNER_EXEMPLO,
  ROTULOS_TIPO,
  abrirPagina,
  afirmarLimpo,
  baixar,
  botaoGerar,
  campo,
  configurarChaves,
  expect,
  folha,
  gerarAta,
  semRolagemHorizontal,
  test,
  textoDoPdf,
  verExemplo,
} from './apoio';
import type { TipoFixture } from './fixtures/respostas';

/**
 * E2E do modo exemplo contra o build com CSP ativa: os quatro exemplos abrem e exportam sem tocar
 * em nenhum provedor, o chunk de cada um só é pedido depois do clique, e a saída ("Começar a
 * minha") deixa a pessoa gerar a ata dela normalmente.
 */

const TIPOS = Object.keys(EXEMPLOS_E2E) as TipoFixture[];
const HOSTS_DOS_PROVEDORES = [
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'api.anthropic.com',
];

/** Texto do motivo dos botões de IA parados (`MOTIVO_EXEMPLO`; o `src/` não entra no Node do E2E). */
const MOTIVO_EXEMPLO =
  'No exemplo, nada é enviado para IA. Para gerar com a sua chave, clique em “Começar a minha”.';

const chunkDoExemplo = (tipo: string) => new RegExp(`/assets/exemplo-${tipo}-[^/]+\\.js$`);

function pedidosDoChunk(rede: { arquivosDoApp: string[] }, inicio: number, tipo: string) {
  return rede.arquivosDoApp.slice(inicio).filter((caminho) => chunkDoExemplo(tipo).test(caminho));
}

test.describe('modo exemplo no build com CSP ativa', () => {
  test('os quatro exemplos abrem, mostram a logo e baixam o PDF sem nenhuma chamada de rede de IA', async ({
    context,
    rede,
  }) => {
    for (const tipo of TIPOS) {
      const { organizacao, arquivo } = EXEMPLOS_E2E[tipo];
      const page = await abrirPagina(context, rede);
      // A lista de arquivos acumula entre as páginas do contexto: só vale o que veio depois daqui.
      const inicio = rede.arquivosDoApp.length;
      expect(pedidosDoChunk(rede, inicio, tipo)).toEqual([]);

      await verExemplo(page, ROTULOS_TIPO[tipo]);
      await expect(page.getByText(FRASE_BANNER_EXEMPLO, { exact: true })).toBeVisible();
      await expect(folha(page)).toContainText(organizacao);
      // A logo é o SVG fictício rasterizado: só aparece se o canvas e a CSP deixaram.
      await expect(folha(page).getByRole('img', { name: 'Logo da organização' })).toBeVisible();
      expect(pedidosDoChunk(rede, inicio, tipo).length).toBeGreaterThan(0);

      // O condomínio sai com uma lacuna de propósito: `baixar` aceita o modal de confirmação.
      const pdf = await baixar(page, 'Baixar PDF');
      expect(pdf.nome).toBe(arquivo);
      const { paginas } = await textoDoPdf(pdf.bytes);
      expect(paginas.join(' ')).toContain(organizacao);

      await afirmarLimpo(page, rede);
      expect(rede.chamadas).toEqual([]);
      await page.close();
    }
  });

  test('chave configurada não muda nada: gerar e regerar seguem parados no exemplo', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
    await verExemplo(page, ROTULOS_TIPO.corporativa);

    await expect(botaoGerar(page)).toBeDisabled();
    await expect(
      page.getByRole('region', { name: 'Gerar ata' }).getByText(MOTIVO_EXEMPLO, { exact: true }),
    ).toBeVisible();
    await expect(
      folha(page)
        .getByRole('button', { name: /^Regerar seção/ })
        .first(),
    ).toBeDisabled();

    await afirmarLimpo(page, rede);
    expect(rede.chamadas).toEqual([]);
  });

  test('a prévia de privacidade do exemplo mascara o CPF e não envia nada', async ({
    app: page,
    rede,
  }) => {
    await verExemplo(page, ROTULOS_TIPO.corporativa);
    await page.getByRole('button', { name: 'Ver o que vai para a IA' }).click();
    const dialogo = page.getByRole('dialog', { name: 'O que vai para a IA' });
    await expect(dialogo.getByRole('region', { name: 'Original', exact: true })).toContainText(CPF);
    const enviado = dialogo.getByRole('region', { name: 'Enviado à IA', exact: true });
    await expect(enviado).toContainText('[CPF_1]');
    await expect(enviado).not.toContainText(CPF);

    await afirmarLimpo(page, rede);
    expect(rede.chamadas).toEqual([]);
  });

  test.describe('saída do exemplo', () => {
    test.use({ cenario: { openai: 'ok' } });

    test('"Começar a minha" esvazia o formulário e a ata própria é gerada normalmente', async ({
      app: page,
      rede,
    }) => {
      await verExemplo(page, ROTULOS_TIPO.corporativa);
      await page.getByRole('button', { name: 'Começar a minha' }).click();

      await expect(
        page.getByText(
          'Exemplo fechado. O formulário está vazio para a sua ata; o tipo “Reunião corporativa” foi mantido.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(campo(page, 'Transcrição da reunião')).toHaveValue('');
      await expect(page.getByText(FRASE_BANNER_EXEMPLO, { exact: true })).toBeHidden();
      expect(rede.chamadas).toEqual([]);

      await gerarAta(page);
      await expect(page.getByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
      expect(rede.chamadas.length).toBeGreaterThan(0);
      for (const chamada of rede.chamadas) {
        expect(HOSTS_DOS_PROVEDORES).toContain(new URL(chamada.url).hostname);
      }
      await afirmarLimpo(page, rede);
    });
  });

  test('a 360 px o exemplo cabe na tela e o banner aparece nas duas abas', async ({
    app: page,
    rede,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await verExemplo(page, ROTULOS_TIPO.condominio);
    await semRolagemHorizontal(page);

    const alvos = ['Ver exemplo', 'Privacidade: como verificar', 'Começar a minha'];
    for (const nome of alvos) {
      const caixa = await page.getByRole('button', { name: nome, exact: true }).boundingBox();
      expect(caixa, nome).not.toBeNull();
      expect(caixa?.x ?? -1, nome).toBeGreaterThanOrEqual(0);
      expect((caixa?.x ?? 0) + (caixa?.width ?? 0), nome).toBeLessThanOrEqual(360);
      expect(caixa?.y ?? -1, nome).toBeGreaterThanOrEqual(0);
    }

    await page.getByRole('button', { name: 'Privacidade: como verificar', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Privacidade: como verificar' });
    await expect(dialogo).toBeVisible();
    const sobra = await dialogo.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();

    await abaFuncionaComBanner(page, 'Editar');
    await abaFuncionaComBanner(page, 'Documento');

    await afirmarLimpo(page, rede);
    expect(rede.chamadas).toEqual([]);
  });
});

/** Seleciona a aba, confere o painel dela e o banner do exemplo ainda visível. */
async function abaFuncionaComBanner(page: Page, nome: 'Editar' | 'Documento') {
  await page.getByRole('tab', { name: nome }).click();
  await expect(page.getByRole('tab', { name: nome })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(FRASE_BANNER_EXEMPLO, { exact: true })).toBeVisible();
  if (nome === 'Documento') await expect(folha(page)).toBeVisible();
  else await expect(campo(page, 'Transcrição da reunião')).toBeVisible();
  await semRolagemHorizontal(page);
}
