import {
  expect,
  test as base,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  ERRO_LIMITE_OPENAI,
  MARCADOR_CPF,
  respostaAnthropic,
  respostaGemini,
  respostaOpenAi,
} from './fixtures/respostas';

declare global {
  interface Window {
    /** Violações de CSP vistas pela página (`securitypolicyviolation`). */
    __violacoes?: string[];
  }
}

const CPF = '529.982.247-25';
const CPF_SO_DIGITOS = '52998224725';
const CHAVE_OPENAI = 'sk-teste-e2e-123';
const CHAVE_GEMINI = 'AIza-teste-e2e';

/** Espera do retry do app (`ESPERA_RETRY_MS`, 2 s) mais a folga da geração. */
const FOLGA_FALLBACK_MS = 20_000;

type Provedor = 'openai' | 'gemini' | 'anthropic';

const PROVEDOR_POR_HOST: Record<string, Provedor> = {
  'api.openai.com': 'openai',
  'generativelanguage.googleapis.com': 'gemini',
  'api.anthropic.com': 'anthropic',
};
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1']);

interface Chamada {
  provedor: Provedor;
  metodo: string;
  url: string;
  headers: Record<string, string>;
  corpo: string;
}

interface Rede {
  /** Requisições a hosts que não são o app nem os três provedores (devem ficar vazias). */
  violacoes: string[];
  /** Chamadas de geração e de teste de chave que chegaram aos provedores (interceptadas). */
  chamadas: Chamada[];
  /** Erros não tratados e mensagens de erro do console. */
  errosDePagina: string[];
}

interface Cenario {
  /** `limite`: toda geração na OpenAI responde 429 (força o fallback). */
  openai: 'limite' | 'ok';
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
  const rede: Rede = { violacoes: [], chamadas: [], errosDePagina: [] };

  await context.route('**/*', async (route) => {
    const requisicao = route.request();
    const url = new URL(requisicao.url());

    if (HOSTS_LOCAIS.has(url.hostname)) {
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
        cenario.openai === 'limite' ? json(ERRO_LIMITE_OPENAI, 429) : json(respostaOpenAi()),
      );
    } else if (provedor === 'gemini') {
      await route.fulfill(json(respostaGemini()));
    } else {
      await route.fulfill(json(respostaAnthropic()));
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

const test = base.extend<Fixtures>({
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
async function configurarChaves(
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

async function preencherDados(page: Page) {
  await page.getByLabel('Organização').fill('Instituto Horizonte');
  await page.getByLabel('Assunto').fill('Migração do cadastro de fornecedores');
  await page.getByLabel(/^Data/).fill('2026-10-14');
  await page.getByLabel('Início').fill('14:00');
  await page.getByLabel('Modalidade').selectOption('remota');
  await page.getByLabel('Plataforma').fill('videoconferência');
  await page.getByLabel('Pauta').fill('Cronograma do projeto\nCadastro de fornecedores');
}

async function colarParticipantes(page: Page, linhas: string[]) {
  await page.getByRole('button', { name: 'Colar lista' }).click();
  await page.getByLabel('Nomes, um por linha').fill(linhas.join('\n'));
  await page.getByRole('button', { name: 'Adicionar à lista' }).click();
}

const PARTICIPANTES_BASICOS = [
  'Marcos Ferraz — Gerente de TI',
  'Joana Prado — Jurídico',
  'Helena Duarte — Compras',
];

const TRANSCRICAO_BASICA = [
  `Marcos Ferraz: Bom dia a todos. O cadastro do fornecedor depende do documento do sócio, CPF ${CPF}, que já está no sistema.`,
  'Joana Prado: Preciso do contrato de suporte para validar com o jurídico.',
  'Helena Duarte: Decidimos migrar o cadastro até 30/11 e adiar a fase 3.',
].join('\n');

async function preencherReuniao(page: Page) {
  await preencherDados(page);
  await colarParticipantes(page, PARTICIPANTES_BASICOS);
  await page.getByLabel('Transcrição da reunião').fill(TRANSCRICAO_BASICA);
}

/**
 * Transcrição de `tamanho` caracteres em falas de ~800 caracteres (≈ 250 linhas para 200 mil),
 * com o CPF na primeira. Não são linhas curtas de propósito: o Chromium insere cada quebra de
 * linha de um `fill`/colagem como um comando de edição à parte, então 4 mil linhas curtas levam
 * dezenas de segundos até num `<textarea>` puro, sem nenhum código do app (medido no spike desta
 * tarefa). Uma fala de reunião real tem centenas de caracteres.
 */
function transcricaoGrande(tamanho: number): string {
  const frase =
    'comentário sobre o cronograma e o cadastro do fornecedor, com prazos e responsáveis definidos. ';
  const falas: string[] = [];
  let total = 0;
  for (let n = 0; total < tamanho; n++) {
    const abertura =
      n === 0
        ? `Marcos Ferraz: o documento do sócio é o CPF ${CPF}. `
        : `Pessoa ${String(n % 200).padStart(3, '0')}: `;
    const fala = abertura + frase.repeat(8);
    falas.push(fala);
    total += fala.length + 1;
  }
  return falas.join('\n').slice(0, tamanho);
}

/** Console com erro além dos 429 que o próprio cenário provoca (o navegador loga toda resposta 4xx). */
function errosInesperados(rede: Rede): string[] {
  return rede.errosDePagina.filter((erro) => !erro.includes('status of 429'));
}

async function violacoesDeCsp(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__violacoes ?? []);
}

/** Toda a memória do navegador desta página (chaves e valores), para procurar a chave de API. */
async function conteudoDosStorages(page: Page): Promise<{ local: string[]; sessao: string[] }> {
  return page.evaluate(() => {
    const ler = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, i) => {
        const chave = storage.key(i) ?? '';
        return `${chave}=${storage.getItem(chave) ?? ''}`;
      });
    return { local: ler(localStorage), sessao: ler(sessionStorage) };
  });
}

function folha(page: Page): Locator {
  return page.getByRole('article', { name: 'Prévia da ata' });
}

test.describe('fluxo da ata no build com CSP ativa', () => {
  test('gera a ata com fallback OpenAI → Gemini, restaura o CPF e não vaza nada', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI, 'Google Gemini': CHAVE_GEMINI });
    await expect(page.getByRole('banner').getByRole('button')).toContainText('IA: OpenAI → Gemini');

    await preencherReuniao(page);
    const gerar = page.getByRole('button', { name: /Gerar ata/ });
    await expect(gerar).toBeEnabled();
    await expect(page.getByText(/Envia para OpenAI · gpt-6-luna \(depois Gemini\)/)).toBeVisible();
    await gerar.click();

    // A OpenAI responde 429 duas vezes (tentativa + 1 retry após 2 s) e a cadeia cai no Gemini.
    await expect(page.getByText('Ata gerada por Gemini · gemini-3.8-flash')).toBeVisible({
      timeout: FOLGA_FALLBACK_MS,
    });
    await expect(page.getByText('OpenAI falhou: limite de uso')).toBeVisible();

    // A folha tem todas as seções, os encaminhamentos e o CPF restaurado.
    const documento = folha(page);
    for (const titulo of [
      'Resumo',
      'Discussão por item de pauta',
      'Decisões',
      'Pendências',
      'Riscos',
      'Próxima reunião',
      'Encaminhamentos',
    ]) {
      await expect(documento.getByRole('heading', { name: titulo })).toBeVisible();
    }
    await expect(documento).toContainText('Migrar o cadastro de fornecedores até 30/11.');
    await expect(documento.getByRole('table', { name: 'Encaminhamentos' })).toContainText(
      'Enviar o contrato de suporte ao jurídico',
    );
    await expect(documento).toContainText(CPF);
    await expect(documento).not.toContainText(MARCADOR_CPF);

    // O que saiu para os provedores: marcador no lugar do CPF, chave só em header.
    const geracoes = rede.chamadas.filter((c) => c.metodo === 'POST');
    expect(geracoes.filter((c) => c.provedor === 'openai')).toHaveLength(2);
    expect(geracoes.filter((c) => c.provedor === 'gemini')).toHaveLength(1);
    expect(geracoes.filter((c) => c.provedor === 'anthropic')).toHaveLength(0);
    for (const chamada of geracoes) {
      expect(chamada.corpo).toContain(MARCADOR_CPF);
      expect(chamada.corpo).not.toContain(CPF);
      expect(chamada.corpo).not.toContain(CPF_SO_DIGITOS);
      for (const chave of [CHAVE_OPENAI, CHAVE_GEMINI]) {
        expect(chamada.url).not.toContain(chave);
        expect(chamada.corpo).not.toContain(chave);
      }
    }
    expect(geracoes.find((c) => c.provedor === 'gemini')?.headers['x-goog-api-key']).toBe(
      CHAVE_GEMINI,
    );
    expect(geracoes.find((c) => c.provedor === 'openai')?.headers.authorization).toBe(
      `Bearer ${CHAVE_OPENAI}`,
    );

    // Sem chave nos storages (nem no rascunho) e sem nada fora da CSP.
    await expect
      .poll(async () => (await conteudoDosStorages(page)).sessao.length)
      .toBeGreaterThan(0);
    const { local, sessao } = await conteudoDosStorages(page);
    expect(local).toEqual([]);
    expect(sessao.join('\n')).not.toContain(CHAVE_OPENAI);
    expect(sessao.join('\n')).not.toContain(CHAVE_GEMINI);

    expect(rede.violacoes).toEqual([]);
    expect(await violacoesDeCsp(page)).toEqual([]);
    // Só os dois 429 provocados de propósito (tentativa + retry) aparecem no console.
    expect(errosInesperados(rede)).toEqual([]);
    expect(rede.errosDePagina).toHaveLength(2);
  });

  test.describe('celular (360×740)', () => {
    test.use({ viewport: { width: 360, height: 740 }, cenario: { openai: 'ok' } });

    test('sem rolagem horizontal; as abas Editar e Documento funcionam', async ({
      app: page,
      rede,
    }) => {
      const semRolagemHorizontal = async () => {
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
        expect(medidas.maiorDireitaDosCartoes).toBeLessThanOrEqual(
          medidas.direitaDoConteiner + 0.5,
        );
        expect(medidas.menorEsquerdaDosCartoes).toBeGreaterThanOrEqual(-0.5);
      };

      await expect(page.getByRole('tab', { name: 'Editar' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await semRolagemHorizontal();

      // 30 participantes com cargo comprido: a lista vira cartões e não pode estourar a largura.
      await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
      await preencherDados(page);
      await colarParticipantes(
        page,
        Array.from(
          { length: 30 },
          (_, i) =>
            `Participante ${String(i + 1)} de Sobrenome Muito Comprido — Coordenação de Operações e Relacionamento`,
        ),
      );
      await page.getByLabel('Transcrição da reunião').fill(TRANSCRICAO_BASICA);
      await semRolagemHorizontal();

      // As abas trocam o painel visível sem perder o que foi digitado.
      await page.getByRole('tab', { name: 'Documento' }).click();
      await expect(page.getByRole('tab', { name: 'Documento' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(folha(page)).toBeVisible();
      await expect(page.getByRole('button', { name: /Gerar ata/ })).toBeHidden();
      await semRolagemHorizontal();

      await page.getByRole('tab', { name: 'Editar' }).click();
      await expect(page.getByLabel('Organização')).toHaveValue('Instituto Horizonte');
      await expect(page.getByLabel('Transcrição da reunião')).toHaveValue(TRANSCRICAO_BASICA);

      // Gerar leva sozinho à aba Documento; a ata pronta também cabe na largura.
      await page.getByRole('button', { name: /Gerar ata/ }).click();
      await expect(page.getByRole('tab', { name: 'Documento' })).toHaveAttribute(
        'aria-selected',
        'true',
        { timeout: FOLGA_FALLBACK_MS },
      );
      await expect(folha(page).getByRole('heading', { name: 'Decisões' })).toBeVisible();
      await expect(folha(page)).toContainText(CPF);
      await semRolagemHorizontal();

      expect(rede.violacoes).toEqual([]);
      expect(await violacoesDeCsp(page)).toEqual([]);
      expect(rede.errosDePagina).toEqual([]);
    });
  });

  test('volume: 200 participantes e 200 mil caracteres continuam utilizáveis', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { 'Google Gemini': CHAVE_GEMINI });
    await preencherDados(page);

    // 200 participantes de uma vez, pelo "Colar lista".
    const participantes = Array.from(
      { length: 200 },
      (_, i) => `Pessoa ${String(i + 1).padStart(3, '0')} Teste — Cargo ${String((i % 9) + 1)}`,
    );
    await colarParticipantes(page, participantes);
    await expect(page.getByText('200 participantes · 200 presentes')).toBeVisible();

    // 200 mil caracteres de transcrição: o `fill` não pode travar a digitação.
    const transcricao = transcricaoGrande(200_000);
    expect(transcricao).toHaveLength(200_000);

    const campo = page.getByLabel('Transcrição da reunião');
    const inicio = Date.now();
    await campo.fill(transcricao);
    const duracaoFill = Date.now() - inicio;
    expect(duracaoFill).toBeLessThan(2_000);
    await expect(page.getByTestId('contador-transcricao')).toContainText(/200\.000 de 300\.000/);

    // Continua digitando no texto gigante, sem esperar a prévia de privacidade.
    const inicioDigitando = Date.now();
    await campo.pressSequentially('fim', { delay: 0 });
    expect(Date.now() - inicioDigitando).toBeLessThan(2_000);

    // A folha mostra as 200 linhas da tabela de participantes (e o formulário, também).
    await expect(
      folha(page).getByRole('table', { name: 'Participantes' }).locator('tbody tr'),
    ).toHaveCount(200);
    await expect(
      page.getByRole('region', { name: 'Lista de participantes' }).locator('tbody tr'),
    ).toHaveCount(200);

    // A geração com esse volume termina (só há chave do Gemini: a cadeia vai direto a ele).
    await page.getByRole('button', { name: /Gerar ata/ }).click();
    await expect(page.getByText('Ata gerada por Gemini · gemini-3.8-flash')).toBeVisible({
      timeout: FOLGA_FALLBACK_MS,
    });
    await expect(folha(page)).toContainText(CPF);
    const [chamada] = rede.chamadas.filter((c) => c.metodo === 'POST');
    expect(chamada?.corpo).not.toContain(CPF);
    expect(chamada?.corpo).toContain(MARCADOR_CPF);

    expect(rede.violacoes).toEqual([]);
    expect(await violacoesDeCsp(page)).toEqual([]);
    expect(rede.errosDePagina).toEqual([]);
  });

  test('a auditoria enxerga uma violação de CSP (os "vazios" dos outros testes não são cegos)', async ({
    app: page,
    rede,
  }) => {
    expect(await violacoesDeCsp(page)).toEqual([]);

    // Um host fora da lista: a CSP (connect-src) bloqueia antes de a requisição sair.
    const resultado = await page.evaluate(() =>
      fetch('https://example.com/rastreador').then(
        () => 'saiu',
        () => 'bloqueado',
      ),
    );

    expect(resultado).toBe('bloqueado');
    await expect.poll(() => violacoesDeCsp(page)).toHaveLength(1);
    expect((await violacoesDeCsp(page))[0]).toContain('connect-src');
    expect(rede.violacoes).toEqual([]);
  });

  test('a chave nunca vai para localStorage nem sessionStorage sem "Lembrar"', async ({
    app: page,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI, 'Google Gemini': CHAVE_GEMINI });
    // Mexe no formulário para o rascunho ser gravado na sessão.
    await page.getByLabel('Organização').fill('Instituto Horizonte');
    await expect
      .poll(async () => (await conteudoDosStorages(page)).sessao.length)
      .toBeGreaterThan(0);

    const { local, sessao } = await conteudoDosStorages(page);
    expect(local).toEqual([]);
    for (const chave of [CHAVE_OPENAI, CHAVE_GEMINI]) {
      expect(sessao.join('\n')).not.toContain(chave);
      expect(page.url()).not.toContain(chave);
    }
    await page.getByRole('button', { name: 'Configurar chaves de IA' }).click();
    await expect(page.getByRole('checkbox', { name: 'Lembrar neste navegador' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Concluir' }).click();

    // Recarregar descarta as chaves: o cabeçalho volta ao estado sem chave.
    await page.reload();
    await expect(page.getByRole('banner').getByRole('button')).not.toContainText('IA:');
    expect((await conteudoDosStorages(page)).local).toEqual([]);
  });
});
