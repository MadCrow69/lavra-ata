import type { Locator, Page } from '@playwright/test';
import {
  CHAVE_OPENAI,
  CPF,
  EXEMPLOS_E2E,
  FRASE_BANNER_EXEMPLO,
  PROVEDOR_POR_HOST,
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
  type Rede,
} from './apoio';
import type { TipoFixture } from './fixtures/respostas';

/**
 * E2E do modo exemplo contra o build com CSP ativa: os quatro exemplos abrem e exportam sem tocar
 * em nenhum provedor, o chunk de cada um só é pedido depois do clique, e a saída ("Começar a
 * minha") deixa a pessoa gerar a ata dela normalmente.
 */

const TIPOS = Object.keys(EXEMPLOS_E2E) as TipoFixture[];

/** Texto do motivo dos botões de IA parados (`MOTIVO_EXEMPLO`; o `src/` não entra no Node do E2E). */
const MOTIVO_EXEMPLO =
  'No exemplo, nada é enviado para IA. Para gerar com a sua chave, clique em “Começar a minha”.';

const chunkDoExemplo = (tipo: string) => new RegExp(`/assets/exemplo-${tipo}-[^/]+\\.js$`);

/** Os tipos cujo chunk `exemplo-<tipo>` o navegador pediu desde `inicio` (a lista acumula). */
function tiposPedidos(rede: Rede, inicio: number): TipoFixture[] {
  const recorte = rede.arquivosDoApp.slice(inicio);
  return TIPOS.filter((tipo) => recorte.some((caminho) => chunkDoExemplo(tipo).test(caminho)));
}

test.describe('modo exemplo no build com CSP ativa', () => {
  test('os quatro exemplos abrem, mostram a logo e baixam o PDF sem nenhuma chamada de rede de IA', async ({
    context,
    rede,
  }) => {
    for (const tipo of TIPOS) {
      const { organizacao, arquivo } = EXEMPLOS_E2E[tipo];
      // Antes de abrir a página: a lista acumula entre as páginas do contexto, e o recorte tem de
      // incluir tudo o que ESTA página pedir, a carga inicial inclusive.
      const inicio = rede.arquivosDoApp.length;
      const page = await abrirPagina(context, rede);
      // Com o app já na tela e antes do clique, nenhum exemplo foi pedido.
      expect(tiposPedidos(rede, inicio)).toEqual([]);

      await verExemplo(page, ROTULOS_TIPO[tipo]);
      // Só o chunk do tipo escolhido veio; os outros três seguem sem ser pedidos.
      expect(tiposPedidos(rede, inicio)).toEqual([tipo]);

      await expect(folha(page).locator('[class*="cabecalho"]').first()).toContainText(organizacao);
      // A logo é o SVG fictício rasterizado: só vale se o canvas e a CSP deixaram desenhar.
      const logo = folha(page).getByRole('img', { name: 'Logo da organização' });
      await expect(logo).toBeVisible();
      expect(await logo.getAttribute('src')).toMatch(/^(data|blob):/);
      expect(await logo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(
        0,
      );

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
        expect(Object.keys(PROVEDOR_POR_HOST)).toContain(new URL(chamada.url).hostname);
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

/** Teto do cabeçalho a 360 px (antes da grade compacta ele ocupava 231 dos 740 px da tela). */
const ALTURA_MAXIMA_CABECALHO_360 = 170;

/** Cor de fundo calculada de um elemento, e a de um elemento com `background: var(token)`. */
async function fundo(alvo: Locator): Promise<string> {
  return alvo.evaluate((el) => getComputedStyle(el).backgroundColor);
}
async function corDoToken(page: Page, token: string): Promise<string> {
  return page.evaluate((nome) => {
    const sonda = document.createElement('div');
    sonda.style.setProperty('background', `var(${nome})`);
    document.body.append(sonda);
    const cor = getComputedStyle(sonda).backgroundColor;
    sonda.remove();
    return cor;
  }, token);
}

test.describe('visitante sem chave, no celular', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('"Ver exemplo" é a ação principal, o cabeçalho é compacto e o texto longo rola pelo teclado', async ({
    app: page,
    rede,
  }) => {
    const cabecalho = page.getByRole('banner');
    const altura = (await cabecalho.boundingBox())?.height ?? Infinity;
    expect(altura).toBeLessThanOrEqual(ALTURA_MAXIMA_CABECALHO_360);
    const acoes = cabecalho.getByRole('navigation', { name: 'Ações do cabeçalho' });
    for (const alvo of [
      acoes.getByRole('button', { name: 'Ver exemplo', exact: true }),
      acoes.getByRole('button', { name: 'Privacidade: como verificar', exact: true }),
      acoes.getByRole('button', { name: 'Configurar chaves de IA', exact: true }),
      acoes.getByRole('link', { name: /^GitHub/ }),
    ]) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect((caixa?.x ?? 0) + (caixa?.width ?? Infinity)).toBeLessThanOrEqual(360);
    }

    // Sem chave e sem nada na bancada: o exemplo é o botão cheio; as chaves, o contornado.
    const primaria = await corDoToken(page, '--cor-primaria');
    const verExemploBotao = acoes.getByRole('button', { name: 'Ver exemplo', exact: true });
    const chaves = acoes.getByRole('button', { name: 'Configurar chaves de IA', exact: true });
    expect(await fundo(verExemploBotao)).toBe(primaria);
    expect(await fundo(chaves)).not.toBe(primaria);

    await verExemplo(page, ROTULOS_TIPO.corporativa);
    // Com o exemplo na bancada, a ênfase volta às chaves (o caminho para a ata da pessoa).
    expect(await fundo(verExemploBotao)).not.toBe(primaria);
    expect(await fundo(chaves)).toBe(primaria);

    await acoes.getByRole('button', { name: 'Privacidade: como verificar', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Privacidade: como verificar' });
    await expect(dialogo).toBeVisible();

    // O corpo longo entra no Tab e rola pelas setas até "O que não é protegido" (só texto).
    const corpo = dialogo.getByRole('region', { name: 'Texto de Privacidade: como verificar' });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(corpo).toBeFocused();
    await page.keyboard.press('End');
    await expect(dialogo.getByRole('heading', { name: 'O que não é protegido' })).toBeInViewport();
    expect(await corpo.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();

    await afirmarLimpo(page, rede);
    expect(rede.chamadas).toEqual([]);
  });
});

/** Duas caixas se sobrepõem (área em comum maior que zero)? */
function seCruzam(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const largura of [360, 1000]) {
  test.describe(`aviso e diálogo a ${String(largura)} px`, () => {
    test.use({ viewport: { width: largura, height: 740 } });

    test('o aviso do exemplo espera fora do diálogo de privacidade e volta quando ele fecha', async ({
      app: page,
      rede,
    }) => {
      await verExemplo(page, ROTULOS_TIPO.corporativa);
      const toast = page.getByText(/^Exemplo carregado:/);
      await expect(toast).toBeInViewport();

      // Logo depois do exemplo (dentro dos 6 s do aviso), abre o diálogo alto.
      await page
        .getByRole('navigation', { name: 'Ações do cabeçalho' })
        .getByRole('button', { name: 'Privacidade: como verificar', exact: true })
        .click();
      const dialogo = page.getByRole('dialog', { name: 'Privacidade: como verificar' });
      await expect(dialogo).toBeVisible();
      await expect(toast).not.toBeInViewport();
      const caixaDialogo = await dialogo.boundingBox();
      expect(caixaDialogo).not.toBeNull();
      for (const item of await page.locator('[data-toast]').all()) {
        const caixa = await item.boundingBox();
        if (caixa && caixaDialogo) expect(seCruzam(caixa, caixaDialogo)).toBe(false);
      }

      // O Fechar do diálogo recebe o clique (o Playwright reprova se outro elemento o cobrir).
      await dialogo.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(dialogo).toBeHidden();
      await expect(toast).toBeInViewport();

      await afirmarLimpo(page, rede);
      expect(rede.chamadas).toEqual([]);
    });
  });
}

/** Seleciona a aba, confere o painel dela e o banner do exemplo ainda visível. */
async function abaFuncionaComBanner(page: Page, nome: 'Editar' | 'Documento') {
  await page.getByRole('tab', { name: nome }).click();
  await expect(page.getByRole('tab', { name: nome })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(FRASE_BANNER_EXEMPLO, { exact: true })).toBeVisible();
  if (nome === 'Documento') await expect(folha(page)).toBeVisible();
  else await expect(campo(page, 'Transcrição da reunião')).toBeVisible();
  await semRolagemHorizontal(page);
}
