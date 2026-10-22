import { readFile } from 'node:fs/promises';
import {
  expect,
  test as base,
  type BrowserContext,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { extractText } from 'unpdf';
import {
  ERRO_LIMITE_OPENAI,
  ataGeradaJson,
  respostaAnthropic,
  respostaGemini,
  respostaOpenAi,
  type TipoFixture,
} from './fixtures/respostas';

/**
 * Apoio comum dos E2E contra o build com CSP ativa: a rede auditada, o `test` com a página já
 * aberta e os passos de preenchimento que todos os cenários repetem.
 */

declare global {
  interface Window {
    /** Violações de CSP vistas pela página (`securitypolicyviolation`). */
    __violacoes?: string[];
  }
}

export { expect };

export const CPF = '529.982.247-25';
export const CPF_SO_DIGITOS = '52998224725';
export const CHAVE_OPENAI = 'sk-teste-e2e-123';
export const CHAVE_GEMINI = 'AIza-teste-e2e';

/** Espera do retry do app (`ESPERA_RETRY_MS`, 2 s) mais a folga da geração. */
export const FOLGA_FALLBACK_MS = 20_000;

type Provedor = 'openai' | 'gemini' | 'anthropic';

const PROVEDOR_POR_HOST: Record<string, Provedor> = {
  'api.openai.com': 'openai',
  'generativelanguage.googleapis.com': 'gemini',
  'api.anthropic.com': 'anthropic',
};
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1']);

export interface Chamada {
  provedor: Provedor;
  metodo: string;
  url: string;
  headers: Record<string, string>;
  corpo: string;
}

export interface Rede {
  /** Requisições a hosts que não são o app nem os três provedores (devem ficar vazias). */
  violacoes: string[];
  /** Chamadas de geração e de teste de chave que chegaram aos provedores (interceptadas). */
  chamadas: Chamada[];
  /** Caminhos (`/lavra-ata/assets/x.js`) que o navegador pediu ao próprio app, em ordem. */
  arquivosDoApp: string[];
  /** Erros não tratados e mensagens de erro do console. */
  errosDePagina: string[];
}

export interface Cenario {
  /** `limite`: toda geração na OpenAI responde 429 (força o fallback). */
  openai: 'limite' | 'ok';
  /** Quantos encaminhamentos a resposta traz (padrão: os 2 do fixture). */
  encaminhamentos?: number;
  /** Tipo de ata cujas seções a resposta traz (padrão: `corporativa`). */
  tipo?: TipoFixture;
}

const CORS = { 'access-control-allow-origin': '*' };

function json(corpo: unknown, status = 200) {
  return { status, contentType: 'application/json', headers: CORS, body: JSON.stringify(corpo) };
}

/**
 * Rede auditada: o app e o `localhost` passam; os três provedores são respondidos com JSON fixo;
 * QUALQUER outro host é abortado e entra em `violacoes`. Nenhuma requisição sai de verdade.
 */
async function auditarRede(context: BrowserContext, cenario: Cenario): Promise<Rede> {
  const rede: Rede = { violacoes: [], chamadas: [], arquivosDoApp: [], errosDePagina: [] };
  const texto = ataGeradaJson({
    ...(cenario.encaminhamentos === undefined ? {} : { encaminhamentos: cenario.encaminhamentos }),
    ...(cenario.tipo === undefined ? {} : { tipo: cenario.tipo }),
  });

  await context.route('**/*', async (route) => {
    const requisicao = route.request();
    const url = new URL(requisicao.url());

    if (HOSTS_LOCAIS.has(url.hostname)) {
      rede.arquivosDoApp.push(url.pathname);
      await route.continue();
      return;
    }
    const provedor = PROVEDOR_POR_HOST[url.hostname];
    if (provedor === undefined) {
      rede.violacoes.push(`${requisicao.method()} ${requisicao.url()}`);
      await route.abort();
      return;
    }
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...CORS,
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      });
      return;
    }

    rede.chamadas.push({
      provedor,
      metodo: requisicao.method(),
      url: requisicao.url(),
      headers: requisicao.headers(),
      corpo: requisicao.postData() ?? '',
    });

    if (requisicao.method() !== 'POST') {
      await route.fulfill(json({ data: [], models: [] }));
    } else if (provedor === 'openai') {
      await route.fulfill(
        cenario.openai === 'limite' ? json(ERRO_LIMITE_OPENAI, 429) : json(respostaOpenAi(texto)),
      );
    } else if (provedor === 'gemini') {
      await route.fulfill(json(respostaGemini(texto)));
    } else {
      await route.fulfill(json(respostaAnthropic(texto)));
    }
  });

  return rede;
}

interface Fixtures {
  /** Cenário da rede deste teste; o padrão força o fallback OpenAI → Gemini. */
  cenario: Cenario;
  rede: Rede;
  /** Página já aberta no app, com a auditoria de CSP e de erros instalada. */
  app: Page;
}

/**
 * Abre uma página nova no app (mesmo contexto: o `localStorage` é o mesmo, o `sessionStorage` não),
 * com a auditoria de CSP e de erros do console instalada ANTES do primeiro script do app.
 */
export async function abrirPagina(context: BrowserContext, rede: Rede): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener(
      'securitypolicyviolation',
      (e) => {
        window.__violacoes?.push(`${e.violatedDirective} ${e.blockedURI}`);
      },
      true,
    );
  });
  page.on('pageerror', (erro) => {
    rede.errosDePagina.push(erro.message);
  });
  page.on('console', (mensagem) => {
    if (mensagem.type() === 'error') rede.errosDePagina.push(mensagem.text());
  });
  await page.goto('./');
  await expect(page.getByRole('banner')).toBeVisible();
  return page;
}

export const test = base.extend<Fixtures>({
  cenario: [{ openai: 'limite' }, { option: true }],
  rede: async ({ context, cenario }, usar) => {
    await usar(await auditarRede(context, cenario));
  },
  app: async ({ context, rede }, usar) => {
    await usar(await abrirPagina(context, rede));
  },
});

/** Abre o modal de chaves pelo cabeçalho, digita as chaves (OpenAI antes do Gemini) e conclui. */
export async function configurarChaves(
  page: Page,
  chaves: Partial<Record<'OpenAI' | 'Google Gemini', string>>,
) {
  await page.getByRole('button', { name: 'Configurar chaves de IA' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Chaves de IA' });
  for (const [rotulo, chave] of Object.entries(chaves)) {
    await dialogo.getByRole('region', { name: rotulo }).getByLabel('Chave de API').fill(chave);
  }
  await dialogo.getByRole('button', { name: 'Concluir' }).click();
  await expect(dialogo).toBeHidden();
}

export async function preencherDados(page: Page) {
  await page.getByLabel('Organização').fill('Instituto Horizonte');
  await page.getByLabel('Assunto').fill('Migração do cadastro de fornecedores');
  await campo(page, 'Data').fill('2026-10-14');
  await page.getByLabel('Início').fill('14:00');
  await page.getByLabel('Modalidade').selectOption('remota');
  await page.getByLabel('Plataforma').fill('videoconferência');
  await page.getByLabel('Pauta').fill('Cronograma do projeto\nCadastro de fornecedores');
}

/** Cola a lista pelo "Colar lista"; com `aviso`, espera o texto exato que o app anuncia depois. */
export async function colarParticipantes(page: Page, linhas: string[], aviso?: string) {
  await page.getByRole('button', { name: 'Colar lista' }).click();
  await page.getByLabel('Nomes, um por linha').fill(linhas.join('\n'));
  await page.getByRole('button', { name: 'Adicionar à lista' }).click();
  if (aviso !== undefined) await expect(page.getByText(aviso, { exact: true })).toBeVisible();
}

const escaparRegExp = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Campo do formulário pelo rótulo exato: "Data" não casa com "Data do edital". O `getByLabel` lê o
 * texto do `<label>` (inclusive o " *" do obrigatório, que é `aria-hidden`), por isso o asterisco
 * opcional no fim da âncora.
 */
export function campo(page: Page, rotulo: string): Locator {
  return page.getByLabel(new RegExp(`^${escaparRegExp(rotulo)}(?:\\s*\\*)?$`));
}

/**
 * Preenche campos do bloco "Dados da reunião" na ordem dada (um campo condicional só existe depois
 * do que o ativa): `select` pelo texto da opção, o resto digitado. Rótulo ambíguo falha (modo estrito).
 */
export async function preencherCampos(page: Page, valores: Record<string, string>) {
  for (const [rotulo, valor] of Object.entries(valores)) {
    const alvo = campo(page, rotulo);
    if ((await alvo.evaluate((el) => el.tagName)) === 'SELECT') {
      await alvo.selectOption({ label: valor });
    } else {
      await alvo.fill(valor);
    }
  }
}

/** "Preencher os vazios — {rotuloCampo}": escolhe o valor e aplica só a quem ainda não tem. */
export async function preencherVazios(page: Page, rotuloCampo: string, rotuloValor: string) {
  await page
    .getByLabel(`Valor para os vazios — ${rotuloCampo}`, { exact: true })
    .selectOption({ label: rotuloValor });
  await page.getByRole('button', { name: `Aplicar — ${rotuloCampo}`, exact: true }).click();
}

/** Marca o tipo de ata pelo rótulo exato (o nome do rádio inclui a descrição, por isso o `label`). */
export async function escolherTipo(page: Page, rotulo: string) {
  await page
    .locator('label')
    .filter({ has: page.getByText(rotulo, { exact: true }) })
    .getByRole('radio')
    .click();
}

/** Rótulo de cada tipo de ata como aparece nos rádios do formulário e no seletor "Ver exemplo". */
export const ROTULOS_TIPO: Record<TipoFixture, string> = {
  corporativa: 'Reunião corporativa',
  cipa: 'CIPA — reunião ordinária ou extraordinária',
  condominio: 'Condomínio — assembleia geral',
  'socios-ltda': 'Sócios de Ltda — reunião ou assembleia',
};

/**
 * O que cada exemplo mostra: o nome da organização no cabeçalho da folha e o arquivo do PDF
 * (`ata-<tipo>-<data>.pdf`). Repetição inevitável de `src/exemplos/dados/*`: esses módulos importam
 * `?raw` (a logo SVG), que o Node do Playwright não resolve.
 */
export const EXEMPLOS_E2E: Record<TipoFixture, { organizacao: string; arquivo: string }> = {
  corporativa: {
    organizacao: 'Exemplo Tecnologia Ltda.',
    arquivo: 'ata-corporativa-2026-10-14.pdf',
  },
  cipa: { organizacao: 'Metalúrgica Exemplo Ltda.', arquivo: 'ata-cipa-2026-10-08.pdf' },
  condominio: {
    organizacao: 'Condomínio Edifício Exemplo',
    arquivo: 'ata-condominio-2026-10-15.pdf',
  },
  'socios-ltda': {
    organizacao: 'Exemplo Comércio de Alimentos Ltda.',
    arquivo: 'ata-socios-ltda-2026-10-20.pdf',
  },
};

export const FRASE_BANNER_EXEMPLO = 'Você está vendo um exemplo — nada foi enviado para IA.';

/** "Ver exemplo" → escolhe o tipo → espera o seletor fechar e o banner do modo exemplo aparecer. */
export async function verExemplo(page: Page, rotuloDoTipo: string) {
  await page.getByRole('button', { name: 'Ver exemplo', exact: true }).click();
  const seletor = page.getByRole('dialog', { name: 'Ver um exemplo' });
  await seletor.getByRole('button', { name: rotuloDoTipo, exact: true }).click();
  await expect(seletor).toBeHidden();
  await expect(page.getByText(FRASE_BANNER_EXEMPLO, { exact: true })).toBeVisible();
}

export const PARTICIPANTES_BASICOS = [
  'Marcos Ferraz — Gerente de TI',
  'Joana Prado — Jurídico',
  'Helena Duarte — Compras',
];

export const TRANSCRICAO_BASICA = [
  `Marcos Ferraz: Bom dia a todos. O cadastro do fornecedor depende do documento do sócio, CPF ${CPF}, que já está no sistema.`,
  'Joana Prado: Preciso do contrato de suporte para validar com o jurídico.',
  'Helena Duarte: Decidimos migrar o cadastro até 30/11 e adiar a fase 3.',
].join('\n');

export async function preencherReuniao(page: Page) {
  await preencherDados(page);
  await colarParticipantes(page, PARTICIPANTES_BASICOS);
  await campo(page, 'Transcrição da reunião').fill(TRANSCRICAO_BASICA);
}

/**
 * Cola `texto` no campo como a pessoa cola: texto na área de transferência, foco no campo e
 * Ctrl+V. (`locator.fill` NÃO serve de medida: ele insere cada quebra de linha como um comando de
 * edição à parte, e 4 mil linhas levam ~25 s até num `<textarea>` puro; a colagem nativa leva
 * ~100 ms.) Devolve o caminho usado: `clipboard` (colagem de verdade) ou, se o navegador negar a
 * área de transferência, `setter` (valor pelo setter nativo + evento `input`, que o React lê).
 */
export async function colarComoPessoa(page: Page, campo: Locator, texto: string): Promise<string> {
  await campo.focus();
  try {
    await page.evaluate((t) => navigator.clipboard.writeText(t), texto);
    await page.keyboard.press('Control+V');
    return 'clipboard';
  } catch {
    await campo.evaluate((el, t) => {
      const alvo = el as HTMLTextAreaElement;
      // Setter nativo (e não `alvo.value =`): é o que o React usa para enxergar a mudança.
      Reflect.set(HTMLTextAreaElement.prototype, 'value', t, alvo);
      alvo.dispatchEvent(new Event('input', { bubbles: true }));
    }, texto);
    return 'setter';
  }
}

/** Console com erro além dos 429 que o próprio cenário provoca (o navegador loga toda resposta 4xx). */
export function errosInesperados(rede: Rede): string[] {
  return rede.errosDePagina.filter((erro) => !erro.includes('status of 429'));
}

export async function violacoesDeCsp(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__violacoes ?? []);
}

/** Toda a memória do navegador desta página (chaves e valores), para procurar a chave de API. */
export async function conteudoDosStorages(
  page: Page,
): Promise<{ local: string[]; sessao: string[] }> {
  return page.evaluate(() => {
    const ler = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, i) => {
        const chave = storage.key(i) ?? '';
        return `${chave}=${storage.getItem(chave) ?? ''}`;
      });
    return { local: ler(localStorage), sessao: ler(sessionStorage) };
  });
}

export function folha(page: Page): Locator {
  return page.getByRole('article', { name: 'Prévia da ata' });
}

/** A página não rola na horizontal e os cartões do formulário e da folha cabem na largura. */
export async function semRolagemHorizontal(page: Page) {
  const medidas = await page.evaluate(() => {
    const raiz = document.documentElement;
    const conteiner = document.querySelector('main')?.getBoundingClientRect();
    const cartoes = Array.from(
      document.querySelectorAll<HTMLElement>('main section[data-bloco], main article'),
    )
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect());
    return {
      rolagem: raiz.scrollWidth,
      largura: raiz.clientWidth,
      direitaDoConteiner: conteiner?.right ?? 0,
      maiorDireitaDosCartoes: Math.max(0, ...cartoes.map((c) => c.right)),
      menorEsquerdaDosCartoes: Math.min(Infinity, ...cartoes.map((c) => c.left)),
      quantos: cartoes.length,
    };
  });
  expect(medidas.quantos).toBeGreaterThan(0);
  expect(medidas.rolagem).toBeLessThanOrEqual(medidas.largura);
  expect(medidas.maiorDireitaDosCartoes).toBeLessThanOrEqual(medidas.direitaDoConteiner + 0.5);
  expect(medidas.menorEsquerdaDosCartoes).toBeGreaterThanOrEqual(-0.5);
}

/** Nada fora do app e dos provedores, nenhuma violação de CSP e nenhum erro no console. */
export async function afirmarLimpo(page: Page, rede: Rede) {
  expect(rede.violacoes).toEqual([]);
  expect(await violacoesDeCsp(page)).toEqual([]);
  expect(rede.errosDePagina).toEqual([]);
}

/** O botão "Gerar ata" (o ícone é `aria-hidden`: o nome acessível é só o texto). */
export function botaoGerar(page: Page): Locator {
  return page.getByRole('button', { name: 'Gerar ata', exact: true });
}

/** Chaves + dados + clique em "Gerar ata"; espera a folha mostrar os encaminhamentos. */
export async function gerarAta(
  page: Page,
  preencher: () => Promise<void> = () => preencherReuniao(page),
) {
  await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
  await preencher();
  await botaoGerar(page).click();
  await expect(page.getByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible({
    timeout: FOLGA_FALLBACK_MS,
  });
  await expect(folha(page).getByRole('heading', { name: 'Encaminhamentos' })).toBeVisible();
}

export const espacos = (texto: string) => texto.replace(/\s+/g, ' ');

export interface Baixado {
  nome: string;
  bytes: Uint8Array;
}

async function lerDownload(download: Download): Promise<Baixado> {
  const caminho = await download.path();
  return { nome: download.suggestedFilename(), bytes: new Uint8Array(await readFile(caminho)) };
}

/**
 * Clica no botão de exportação e devolve o arquivo baixado. Se a ata tiver lacunas (ou algo mais
 * a confirmar), `aoConfirmar` inspeciona o modal e o "Baixar mesmo assim" segue.
 */
export async function baixar(
  page: Page,
  botao: string,
  aoConfirmar?: (modal: Locator) => Promise<void>,
): Promise<Baixado & { ms: number }> {
  const inicio = Date.now();
  const baixou = page.waitForEvent('download');
  const modal = page.getByRole('dialog');
  const decisao = Promise.race([
    baixou.then(() => 'baixou' as const),
    modal.waitFor({ state: 'visible' }).then(() => 'modal' as const),
  ]);
  // Quem perder a corrida não pode virar rejeição solta quando a página fechar.
  decisao.catch(() => undefined);
  await page.getByRole('button', { name: botao, exact: true }).click();
  if ((await decisao) === 'modal') {
    await aoConfirmar?.(modal);
    await modal.getByRole('button', { name: 'Baixar mesmo assim' }).click();
  }
  const arquivo = await lerDownload(await baixou);
  return { ...arquivo, ms: Date.now() - inicio };
}

export async function textoDoPdf(bytes: Uint8Array): Promise<{ paginas: string[]; total: number }> {
  // pdf.js pode transferir o buffer: extrai de uma cópia.
  const { text, totalPages } = await extractText(bytes.slice(), { mergePages: false });
  return { paginas: text.map(espacos), total: totalPages };
}

export function partesDoDocx(bytes: Uint8Array): Map<string, Uint8Array> {
  return new Map(Object.entries(unzipSync(bytes)));
}

export function xmlDoDocx(bytes: Uint8Array): string {
  const documento = partesDoDocx(bytes).get('word/document.xml');
  if (documento === undefined) throw new Error('word/document.xml ausente no .docx');
  return strFromU8(documento);
}

export const comeca = (bytes: Uint8Array, texto: string) =>
  new TextDecoder('latin1').decode(bytes.subarray(0, texto.length)) === texto;
