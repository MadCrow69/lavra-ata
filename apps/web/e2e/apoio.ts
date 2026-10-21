import {
  expect,
  test as base,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  ERRO_LIMITE_OPENAI,
  ataGeradaJson,
  respostaAnthropic,
  respostaGemini,
  respostaOpenAi,
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
  const texto = ataGeradaJson(
    cenario.encaminhamentos === undefined ? {} : { encaminhamentos: cenario.encaminhamentos },
  );

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

export const test = base.extend<Fixtures>({
  cenario: [{ openai: 'limite' }, { option: true }],
  rede: async ({ context, cenario }, usar) => {
    await usar(await auditarRede(context, cenario));
  },
  app: async ({ page, rede }, usar) => {
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
    await usar(page);
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
  await page.getByLabel(/^Data/).fill('2026-10-14');
  await page.getByLabel('Início').fill('14:00');
  await page.getByLabel('Modalidade').selectOption('remota');
  await page.getByLabel('Plataforma').fill('videoconferência');
  await page.getByLabel('Pauta').fill('Cronograma do projeto\nCadastro de fornecedores');
}

export async function colarParticipantes(page: Page, linhas: string[]) {
  await page.getByRole('button', { name: 'Colar lista' }).click();
  await page.getByLabel('Nomes, um por linha').fill(linhas.join('\n'));
  await page.getByRole('button', { name: 'Adicionar à lista' }).click();
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
  await page.getByLabel('Transcrição da reunião').fill(TRANSCRICAO_BASICA);
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

export function folha(page: Page): Locator {
  return page.getByRole('article', { name: 'Prévia da ata' });
}
