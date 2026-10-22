import type { Locator, Page } from '@playwright/test';
import {
  afirmarLimpo,
  CHAVE_OPENAI,
  CPF,
  TRANSCRICAO_BASICA,
  campo,
  conteudoDosStorages,
  configurarChaves,
  expect,
  folha,
  gerarAta,
  preencherReuniao,
  semRolagemHorizontal,
  test,
} from './apoio';

/**
 * E2E das preferências lembradas no navegador (cor de destaque, tipo, tom, ordem e modelos), contra
 * o build com CSP ativa. O ponto principal: a cor escolhida chega MESMO ao título e aos títulos de
 * seção da folha (cor calculada pelo navegador, que o jsdom dos testes de componente não calcula).
 */

const CHAVE_PREFERENCIAS = 'lavra:preferencias:v1';
const LEMBRAR = 'Lembrar preferências neste navegador';

/** `#rrggbb` → o `rgb(r, g, b)` que o navegador devolve em `getComputedStyle`. */
function rgbDe(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

/** Cor calculada de cada elemento do localizador (`color`, depois do CSS e das variáveis). */
async function coresCalculadas(alvo: Locator): Promise<string[]> {
  return alvo.evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
}

/** Cor declarada pela folha em `--cor-folha-destaque` (a que o app escolheu). */
async function destaqueDaFolha(page: Page): Promise<string> {
  return folha(page).evaluate((el) =>
    (el as HTMLElement).style.getPropertyValue('--cor-folha-destaque').trim(),
  );
}

/**
 * Cor da amostra da opção, como o navegador a calcula: a paleta do próprio app, lida da tela, sem
 * repetir hexadecimal aqui.
 */
async function rgbDaOpcao(page: Page, rotulo: string): Promise<string> {
  return page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: rotulo }) })
    .locator('[aria-hidden="true"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

const localDoNavegador = async (page: Page) => (await conteudoDosStorages(page)).local;

test.describe('preferências lembradas no build com CSP ativa', () => {
  test.use({ cenario: { openai: 'ok' } });

  test('a cor escolhida chega ao título e aos títulos de seção da folha (cor calculada)', async ({
    app: page,
    rede,
  }) => {
    await gerarAta(page);
    const titulo = folha(page).locator('h2');
    const subtitulos = folha(page).locator('h3');
    expect(await subtitulos.count()).toBeGreaterThan(2);

    // Padrão: a própria tinta do documento, sem mudar nada que já existia.
    const padrao = await destaqueDaFolha(page);
    expect(padrao).toMatch(/^#[0-9a-f]{6}$/);
    expect(await coresCalculadas(titulo)).toEqual([rgbDe(padrao)]);
    expect(new Set(await coresCalculadas(subtitulos))).toEqual(new Set([rgbDe(padrao)]));
    const corDoTexto = await coresCalculadas(folha(page).locator('p').first());

    const vinho = await rgbDaOpcao(page, 'Vinho');
    expect(vinho).not.toBe(rgbDe(padrao));
    await page.getByRole('radio', { name: 'Vinho' }).check();
    await expect(
      page.getByText('Cor de destaque: Vinho. A folha, o PDF e o DOCX usam a nova cor.'),
    ).toBeVisible();

    expect(rgbDe(await destaqueDaFolha(page))).toBe(vinho);
    expect(await coresCalculadas(titulo)).toEqual([vinho]);
    // Todos os títulos de seção (participantes, pauta, seções da ata, encaminhamentos…).
    expect(new Set(await coresCalculadas(subtitulos))).toEqual(new Set([vinho]));
    // O texto corrido da ata não muda de cor.
    expect(await coresCalculadas(folha(page).locator('p').first())).toEqual(corDoTexto);

    await afirmarLimpo(page, rede);
  });

  test('"Lembrar" guarda só as preferências: sobrevive à recarga sem a sessão e nunca leva o conteúdo da ata', async ({
    app: page,
    rede,
  }) => {
    const vinho = await rgbDaOpcao(page, 'Vinho');
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
    await preencherReuniao(page);
    await page.getByRole('radio', { name: /CIPA/ }).check();
    await page.getByLabel('Tom da redação').selectOption('conciso');
    await page.getByRole('radio', { name: 'Vinho' }).check();
    await page.getByRole('checkbox', { name: LEMBRAR }).check();
    await expect(page.getByText('Preferências lembradas neste navegador.')).toBeVisible();

    const guardado = (await localDoNavegador(page)).join('\n');
    expect(guardado).toContain(CHAVE_PREFERENCIAS);
    expect(JSON.parse(guardado.slice(`${CHAVE_PREFERENCIAS}=`.length))).toMatchObject({
      versao: 1,
      tipoId: 'cipa',
      tom: 'conciso',
      destaque: 'vinho',
    });
    // Só as preferências no `localStorage`; nada da ata, dos participantes nem da chave de IA.
    expect(await localDoNavegador(page)).toHaveLength(1);
    for (const proibido of [
      CPF,
      CHAVE_OPENAI,
      'Marcos Ferraz',
      'Instituto Horizonte',
      TRANSCRICAO_BASICA.slice(0, 30),
    ]) {
      expect(guardado).not.toContain(proibido);
    }

    // Outra visita: sessão vazia (o rascunho nem existe), só o `localStorage` sobrou.
    await page.evaluate(() => {
      sessionStorage.clear();
    });
    await page.addInitScript(() => {
      // A recarga grava o rascunho na sessão ao sair; as preferências não são regravadas lá.
      sessionStorage.removeItem('lavra:rascunho:v1');
    });
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Vinho' })).toBeChecked();
    await expect(page.getByRole('radio', { name: /CIPA/ })).toBeChecked();
    await expect(page.getByLabel('Tom da redação')).toHaveValue('conciso');
    await expect(page.getByRole('checkbox', { name: LEMBRAR })).toBeChecked();
    expect(rgbDe(await destaqueDaFolha(page))).toBe(vinho);
    // A ata nova começa limpa: os dados da reunião anterior não voltaram.
    await expect(campo(page, 'Transcrição da reunião')).toHaveValue('');

    await afirmarLimpo(page, rede);
  });

  test('"Esquecer preferências" apaga do navegador e a escolha segue valendo na aba', async ({
    app: page,
    rede,
  }) => {
    const roxo = await rgbDaOpcao(page, 'Roxo');
    await page.getByRole('radio', { name: 'Roxo' }).check();
    await page.getByRole('checkbox', { name: LEMBRAR }).check();
    expect(await localDoNavegador(page)).toHaveLength(1);

    await page.getByRole('button', { name: 'Esquecer preferências' }).click();
    await expect(
      page.getByText(
        'Preferências apagadas deste navegador. As escolhas atuais continuam valendo nesta aba.',
      ),
    ).toBeVisible();
    expect(await localDoNavegador(page)).toEqual([]);
    await expect(page.getByRole('checkbox', { name: LEMBRAR })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: LEMBRAR })).toBeFocused();
    expect(rgbDe(await destaqueDaFolha(page))).toBe(roxo);

    await afirmarLimpo(page, rede);
  });

  test('a ordem e o modelo dos provedores são lembrados e voltam ao abrir o modal de chaves', async ({
    app: page,
    rede,
  }) => {
    await page.getByRole('button', { name: 'Configurar chaves de IA' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Chaves de IA' });
    // Anthropic parte em último: duas subidas a põem na frente da OpenAI.
    await dialogo.getByRole('button', { name: 'Mover Anthropic para cima' }).click();
    await dialogo.getByRole('button', { name: 'Mover Anthropic para cima' }).click();
    const modelo = dialogo.getByRole('region', { name: 'OpenAI' }).getByLabel('Modelo');
    const opcoes = await modelo
      .locator('option')
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    const padrao = await modelo.inputValue();
    const outro = opcoes.find((v) => v !== '__outro__' && v !== padrao) ?? '';
    expect(outro).not.toBe('');
    await modelo.selectOption(outro);
    await dialogo.getByRole('button', { name: 'Concluir' }).click();
    await page.getByRole('checkbox', { name: LEMBRAR }).check();

    await page.evaluate(() => {
      sessionStorage.clear();
    });
    await page.reload();
    await page.getByRole('button', { name: 'Configurar chaves de IA' }).click();
    const aberto = page.getByRole('dialog', { name: 'Chaves de IA' });
    await expect(aberto.getByRole('region', { name: 'OpenAI' }).getByLabel('Modelo')).toHaveValue(
      outro,
    );
    const titulos = await aberto.locator('h3').allTextContents();
    expect(titulos.indexOf('Anthropic')).toBeLessThan(titulos.indexOf('OpenAI'));

    await afirmarLimpo(page, rede);
  });

  test('a 360 px os controles cabem na tela e têm alvo de 44 px', async ({ app: page, rede }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByRole('checkbox', { name: LEMBRAR }).check();
    await semRolagemHorizontal(page);

    const alvos = [
      page.locator('label').filter({ has: page.getByRole('radio', { name: 'Vinho' }) }),
      page.locator('label').filter({ has: page.getByRole('checkbox', { name: LEMBRAR }) }),
      page.getByRole('button', { name: 'Esquecer preferências' }),
    ];
    for (const alvo of alvos) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect((caixa?.x ?? -1) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);
    }

    // Teclado: Tab chega aos rádios e a seta troca a cor, com o aviso do que mudou.
    await page.getByRole('radio', { name: 'Grafite (padrão)' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Azul-marinho' })).toBeChecked();
    await expect(page.getByText(/^Cor de destaque: Azul-marinho\./)).toBeVisible();

    await afirmarLimpo(page, rede);
  });
});
