import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import { erroProvedor } from '../../ai/errors';
import { erroSemCredito } from '../../ai/providers/comum';
import { KeysProvider } from '../../ai/KeysContext';
import { criarKeyStore, type KeyStore } from '../../ai/keys';
import type { GenerateRequest, ProviderAdapter, ProviderConfig, ProviderId } from '../../ai/types';
import { RASCUNHO } from '../../config/storage-keys';
import { ESPERA_SALVAR_RASCUNHO_MS } from '../../config/ui';
import type { AtaDraft } from '../../domain/draft';
import { CHAVE_AVISOS_GERAIS, criarRascunho } from '../../domain/draft-reducer';
import { carregarRascunho, salvarRascunho } from '../../domain/persistence';
import { ToastProvider } from '../../ui/Toast';
import { Workbench } from './Workbench';

const CPF = '529.982.247-25';
const CHAVE_OPENAI = 'sk-teste-ficticia-0001';

type Gerar = (cfg: ProviderConfig, req: GenerateRequest) => Promise<unknown>;

/** Resposta da IA: o resumo cita o CPF pelo marcador (a IA nunca vê o número). */
function resposta(texto = 'Reembolso a [CPF_1].') {
  return {
    secoes: Object.fromEntries(
      corporativa.secoes.map((s) => [
        s.chave,
        s.chave === 'resumo' ? [{ tipo: 'paragrafo', texto, itens: [] }] : [],
      ]),
    ),
    encaminhamentos: [],
  };
}

function adaptadores(gerar: Gerar): Record<ProviderId, ProviderAdapter> {
  const mk = (id: ProviderId, fn: Gerar): ProviderAdapter => ({
    id,
    rotulo: id,
    gerar: fn,
    testarChave: () => Promise.resolve(),
  });
  const naoChamar: Gerar = () => Promise.reject(new Error('não chamar'));
  return {
    openai: mk('openai', gerar),
    gemini: mk('gemini', naoChamar),
    anthropic: mk('anthropic', naoChamar),
  };
}

interface Opcoes {
  gerar?: Gerar;
  store?: KeyStore;
}

function renderizar({ gerar = () => Promise.resolve(resposta()), store }: Opcoes = {}) {
  const espiao = vi.fn<Gerar>(gerar);
  const keyStore = store ?? criarKeyStore(null);
  const utils = render(
    <KeysProvider store={keyStore}>
      <ToastProvider>
        <Workbench opcoesCadeia={{ adaptadores: adaptadores(espiao), esperaRetryMs: 0 }} />
      </ToastProvider>
    </KeysProvider>,
  );
  return { ...utils, gerar: espiao, store: keyStore, user: userEvent.setup() };
}

function comChave(): KeyStore {
  const store = criarKeyStore(null);
  store.definir({ provedor: 'openai', chave: CHAVE_OPENAI, modelo: '', estado: 'ok' });
  return store;
}

/** Rascunho completo, pronto para gerar. */
function completo(parcial: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(),
    dados: {
      organizacao: 'Cooperativa Fictícia',
      assunto: 'Reembolsos',
      data: '2026-10-14',
      inicio: '14:30',
      modalidade: 'remota',
    },
    pauta: ['Reembolsos'],
    participantes: [
      {
        id: 'p1',
        nome: 'Ana Souza',
        papel: '',
        presenca: 'presente',
        justificativa: '',
        extras: {},
      },
    ],
    transcricao: `Ana: reembolso ao CPF ${CPF}.`,
    ...parcial,
  };
}

/** Simula a largura da janela: `(min-width: 1024px)` casa só quando `largo`. */
function simularLargura(largo: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: largo,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** Celular: casa a consulta dos cartões de participantes (`max-width`), não a de duas colunas. */
function simularCelular(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

async function preencherMinimo(user: UserEvent): Promise<void> {
  await user.type(screen.getByLabelText(/^Organização/), 'Cooperativa Fictícia');
  await user.type(screen.getByLabelText(/^Assunto/), 'Reembolsos');
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText(/^Início/), { target: { value: '14:30' } });
  await user.selectOptions(screen.getByLabelText(/^Modalidade/), 'remota');
  await user.type(screen.getByLabelText(/^Pauta/), 'Reembolsos');
  await user.type(screen.getByLabelText(/^Nome do novo participante/), 'Ana Souza{Enter}');
  await user.click(screen.getByLabelText(/^Transcrição da reunião/));
  await user.paste(`Ana: reembolso ao CPF ${CPF}.`);
}

const folha = () => screen.getByRole('article', { name: 'Prévia da ata' });
const botaoGerar = () => screen.getByRole('button', { name: /Gerar ata/ });

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Workbench: fluxo de ponta a ponta', () => {
  it('preencher, colar com CPF, configurar a chave e gerar: a folha mostra o CPF restaurado e o toast diz quem gerou', async () => {
    const rolar = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { user, gerar } = renderizar();

    await preencherMinimo(user);
    // O selo de privacidade aparece depois do debounce da detecção.
    expect(await screen.findByText(/1 dado pessoal será protegido \(1 CPF\)/)).toBeVisible();

    // Sem chave, "Gerar ata" abre o mesmo modal de chaves do cabeçalho.
    await user.click(botaoGerar());
    const dialogo = screen.getByRole('dialog', { name: 'Chaves de IA' });
    await user.type(
      within(screen.getByRole('region', { name: 'OpenAI' })).getByLabelText('Chave de API'),
      CHAVE_OPENAI,
    );
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('dialog', { hidden: true })).toHaveLength(0);

    rolar.mockClear();
    await user.click(botaoGerar());

    expect(await within(folha()).findByText(`Reembolso a ${CPF}.`)).toBeVisible();
    expect(screen.getByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    // A IA recebeu só o marcador.
    expect(gerar).toHaveBeenCalledTimes(1);
    const [, pedido] = gerar.mock.calls[0] ?? [];
    expect(JSON.stringify(pedido)).not.toContain(CPF);
    expect(JSON.stringify(pedido)).toContain('[CPF_1]');
    // A folha rola até o topo depois de gerar.
    expect(rolar).toHaveBeenCalled();
    expect(rolar.mock.contexts.some((el) => el instanceof Element && el.contains(folha()))).toBe(
      true,
    );
  });

  it('o rascunho é salvo com espera (debounce) na sessão, sem a chave de API', async () => {
    const { user } = renderizar({ store: comChave() });
    await user.type(screen.getByLabelText(/^Organização/), 'Cooperativa Fictícia');
    // Logo depois de digitar, ainda não gravou.
    expect(carregarRascunho()?.dados.organizacao ?? '').not.toBe('Cooperativa Fictícia');

    await waitFor(
      () => {
        expect(carregarRascunho()?.dados.organizacao).toBe('Cooperativa Fictícia');
      },
      { timeout: 2000 },
    );
    const bruto = sessionStorage.getItem(RASCUNHO) ?? '';
    expect(bruto).not.toContain(CHAVE_OPENAI);
    expect(localStorage.length).toBe(0);
  });

  it('salva o rascunho pendente ao desmontar (limite de erro)', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderizar();
      fireEvent.change(screen.getByLabelText(/^Assunto/), { target: { value: 'Planejamento' } });
      // Desmonta antes de `ESPERA_SALVAR_RASCUNHO_MS`: o que estava pendente não pode se perder.
      act(() => {
        vi.advanceTimersByTime(ESPERA_SALVAR_RASCUNHO_MS - 1);
      });
      expect(carregarRascunho()?.dados.assunto ?? '').not.toBe('Planejamento');
      unmount();
      expect(carregarRascunho()?.dados.assunto).toBe('Planejamento');
    } finally {
      vi.useRealTimers();
    }
  });

  it('esconder a aba grava o rascunho na hora, sem esperar o debounce', async () => {
    const { user } = renderizar();
    await user.type(screen.getByLabelText(/^Assunto/), 'Reembolsos');
    expect(carregarRascunho()?.dados.assunto ?? '').not.toBe('Reembolsos');

    const visibilidade = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(carregarRascunho()?.dados.assunto).toBe('Reembolsos');
    visibilidade.mockRestore();
  });
});

describe('Workbench: rascunho recuperado', () => {
  it('recarregar (novo render lendo a sessão) recupera o rascunho com o aviso', async () => {
    const primeiro = renderizar();
    await primeiro.user.type(screen.getByLabelText(/^Assunto/), 'Reembolsos');
    await waitFor(
      () => {
        expect(carregarRascunho()?.dados.assunto).toBe('Reembolsos');
      },
      { timeout: 2000 },
    );
    primeiro.unmount();

    renderizar();
    expect(screen.getByText('Rascunho recuperado desta aba.')).toBeVisible();
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue('Reembolsos');
  });

  it('rascunho vazio salvo não mostra o aviso', () => {
    salvarRascunho(criarRascunho());
    renderizar();
    expect(screen.queryByText('Rascunho recuperado desta aba.')).not.toBeInTheDocument();
  });

  it('"Começar do zero" pede confirmação e então limpa', async () => {
    salvarRascunho(completo());
    const { user } = renderizar();
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue('Reembolsos');

    await user.click(screen.getByRole('button', { name: 'Começar do zero' }));
    const dialogo = screen.getByRole('dialog', { name: 'Começar uma nova ata?' });
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue('Reembolsos');

    await user.click(screen.getByRole('button', { name: 'Começar do zero' }));
    await user.click(screen.getByRole('button', { name: 'Apagar e começar' }));
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue('');
    expect(screen.queryByText('Rascunho recuperado desta aba.')).not.toBeInTheDocument();
    expect(screen.getByText('Nova ata iniciada. Tipo e tom mantidos.')).toBeVisible();
    // O foco não se perde no <body>.
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('Workbench: Nova ata', () => {
  it('pede confirmação, limpa tudo e mantém tipo e tom', async () => {
    salvarRascunho(completo({ tom: 'conciso' }));
    const { user } = renderizar();
    await user.click(screen.getByRole('button', { name: 'Fechar aviso de rascunho recuperado' }));

    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    expect(screen.getByRole('dialog', { name: 'Começar uma nova ata?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Apagar e começar' }));

    expect(screen.getByLabelText(/^Organização/)).toHaveValue('');
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue('');
    expect(screen.getByText(/Nenhum participante ainda/)).toBeVisible();
    expect(screen.getByLabelText('Tom da redação')).toHaveValue('conciso');
    expect(screen.getByText('Nova ata iniciada. Tipo e tom mantidos.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nova ata' })).toHaveFocus();
  });

  it('com o rascunho vazio, não pergunta: começa na hora e avisa', async () => {
    const { user } = renderizar();
    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Nova ata iniciada. Tipo e tom mantidos.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nova ata' })).toHaveFocus();
  });

  it('cancela a geração em andamento; o resultado que chega depois é descartado', async () => {
    salvarRascunho(completo());
    let sinal: AbortSignal | null = null;
    let entregar: (v: unknown) => void = () => undefined;
    const { user } = renderizar({
      store: comChave(),
      // O adaptador ignora o cancelamento de propósito: o resultado chega mesmo assim.
      gerar: (_cfg, req) => {
        sinal = req.signal;
        return new Promise((resolve) => {
          entregar = resolve;
        });
      },
    });

    await user.click(botaoGerar());
    expect(screen.getByRole('progressbar', { name: 'Gerando a ata' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    const dialogo = screen.getByRole('dialog', { name: 'Começar uma nova ata?' });
    expect(dialogo).toHaveTextContent('A geração em andamento será cancelada.');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar e começar' }));

    expect((sinal as AbortSignal | null)?.aborted).toBe(true);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await act(async () => {
      entregar(resposta());
      await Promise.resolve();
    });

    expect(within(folha()).queryByText(`Reembolso a ${CPF}.`)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ata gerada por/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Geração cancelada/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue('');
    // A vez de usar a IA foi liberada para a ata nova.
    expect(screen.queryByText('Aguarde a geração em andamento terminar.')).not.toBeInTheDocument();
  });
});

describe('Workbench: conta sem saldo', () => {
  it('geração recusada por falta de saldo: o cartão da chave mostra o saldo, não "verifique se copiou"', async () => {
    salvarRascunho(completo());
    const { user, store } = renderizar({
      store: comChave(),
      gerar: () => Promise.reject(erroSemCredito('openai', 429)),
    });
    await user.click(botaoGerar());
    await waitFor(() => {
      expect(store.cadeia()).toEqual([]);
    });

    await user.click(screen.getByRole('button', { name: 'Configurar chaves de IA' }));
    const cartao = within(screen.getByRole('region', { name: 'OpenAI' }));
    expect(cartao.getByText(/sem crédito ou saldo/)).toBeVisible();
    expect(cartao.queryByText(/verifique se copiou/)).not.toBeInTheDocument();
  });
});

describe('Workbench: estados depois de gerar', () => {
  it('no celular, a aba ativa vira "Documento" ao terminar de gerar', async () => {
    simularLargura(false);
    salvarRascunho(completo());
    const { user } = renderizar({ store: comChave() });
    expect(screen.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true');

    await user.click(botaoGerar());

    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Documento' })).toHaveAttribute('aria-selected', 'true');
    expect(within(folha()).getByText(`Reembolso a ${CPF}.`)).toBeVisible();
    // O botão Gerar ficou na aba oculta: o foco vai para a folha.
    expect(document.getElementById('painel-documento')?.firstElementChild).toHaveFocus();
  });

  it('no celular, a aba Documento mostra a geração em andamento e cancela por ali', async () => {
    simularLargura(false);
    salvarRascunho(completo());
    let sinal: AbortSignal | null = null;
    const { user } = renderizar({
      store: comChave(),
      gerar: (_cfg, req) => {
        sinal = req.signal;
        return new Promise((_resolve, reject) => {
          req.signal.addEventListener('abort', () => {
            reject(erroProvedor('cancelado', 'openai'));
          });
        });
      },
    });
    await user.click(botaoGerar());
    await user.click(screen.getByRole('tab', { name: 'Documento' }));

    const painel = screen.getByRole('tabpanel', { name: 'Documento' });
    expect(within(painel).getByRole('progressbar', { name: 'Gerando a ata' })).toBeVisible();
    expect(within(painel).getByText(/Gerando a ata — pode levar até 2 minutos/)).toBeVisible();
    await user.click(within(painel).getByRole('button', { name: 'Cancelar geração da ata' }));

    expect((sinal as AbortSignal | null)?.aborted).toBe(true);
    expect(within(painel).queryByRole('progressbar')).not.toBeInTheDocument();
    // Cancelar por aqui é cancelar pela pessoa: a barra registra e a ata não muda.
    expect(within(painel).getByText('Geração cancelada. A ata não foi alterada.')).toBeVisible();
    expect(within(folha()).queryByText(`Reembolso a ${CPF}.`)).not.toBeInTheDocument();
  });

  it('o aviso "Geração cancelada" some depois de "Nova ata"', async () => {
    simularLargura(false);
    salvarRascunho(completo());
    const { user } = renderizar({
      store: comChave(),
      gerar: (_cfg, req) =>
        new Promise((_resolve, reject) => {
          req.signal.addEventListener('abort', () => {
            reject(erroProvedor('cancelado', 'openai'));
          });
        }),
    });
    await user.click(botaoGerar());
    await user.click(screen.getByRole('tab', { name: 'Documento' }));
    const painel = screen.getByRole('tabpanel', { name: 'Documento' });
    await user.click(within(painel).getByRole('button', { name: 'Cancelar geração da ata' }));
    expect(within(painel).getByText('Geração cancelada. A ata não foi alterada.')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    await user.click(screen.getByRole('button', { name: 'Apagar e começar' }));
    await user.click(screen.getByRole('tab', { name: 'Documento' }));

    expect(screen.queryByText(/Geração cancelada/)).not.toBeInTheDocument();
  });

  it('no celular, se a geração falha com a pessoa no Documento, volta ao Editar com o erro', async () => {
    simularLargura(false);
    salvarRascunho(completo());
    let falhar: () => void = () => undefined;
    const { user } = renderizar({
      store: comChave(),
      gerar: () =>
        new Promise((_resolve, reject) => {
          falhar = () => {
            reject(erroProvedor('recusa', 'openai'));
          };
        }),
    });
    await user.click(botaoGerar());
    await user.click(screen.getByRole('tab', { name: 'Documento' }));
    await act(async () => {
      falhar();
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true');
  });

  it('em tela larga, a geração em andamento aparece só na barra (sem repetir no Documento)', async () => {
    simularLargura(true);
    salvarRascunho(completo());
    const { user } = renderizar({ store: comChave(), gerar: () => new Promise(() => undefined) });
    await user.click(botaoGerar());
    expect(screen.getAllByRole('progressbar', { name: 'Gerando a ata' })).toHaveLength(1);
  });

  it('no celular, 200 participantes não afastam a transcrição e o "Gerar ata": a lista começa recolhida', () => {
    simularCelular();
    salvarRascunho(
      completo({
        participantes: Array.from({ length: 200 }, (_, i) => ({
          id: `p${String(i + 1)}`,
          nome: `Pessoa ${String(i + 1)}`,
          papel: '',
          presenca: 'presente' as const,
          justificativa: '',
          extras: {},
        })),
      }),
    );
    renderizar();

    expect(document.querySelectorAll('[data-campo="nome"]')).toHaveLength(0);
    expect(screen.getByText('200 participantes · 200 presentes')).toBeVisible();
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toBeVisible();
    expect(botaoGerar()).toBeEnabled();

    fireEvent.click(screen.getByText('Mostrar os 200 participantes'));
    expect(document.querySelectorAll('[data-campo="nome"]')).toHaveLength(200);
    fireEvent.change(screen.getByLabelText('Buscar participante'), {
      target: { value: 'Pessoa 137' },
    });
    expect(document.querySelectorAll('[data-campo="nome"]')).toHaveLength(1);
  });

  it('avisos gerais aparecem uma vez só (acima da folha); no celular a aba Documento os conta', () => {
    simularLargura(false);
    const aviso = 'Seu texto já tinha um trecho parecido com um marcador.';
    salvarRascunho(
      completo({
        resultado: {
          secoes: {},
          encaminhamentos: [],
          atribuicao: {},
          avisos: { [CHAVE_AVISOS_GERAIS]: [aviso] },
          editadas: [],
        },
      }),
    );
    renderizar();

    expect(screen.getAllByText(aviso)).toHaveLength(1);
    const painelDocumento = document.getElementById('painel-documento');
    expect(painelDocumento).not.toBeNull();
    expect(painelDocumento?.contains(screen.getByText(aviso))).toBe(true);
    expect(screen.getByRole('tab', { name: 'Documento, 1 aviso' })).toBeInTheDocument();
  });

  it('editor de seção aberto durante a geração completa fecha ao chegar a ata nova', async () => {
    salvarRascunho(
      completo({
        resultado: {
          secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Texto antigo.', itens: [] }] },
          encaminhamentos: [],
          atribuicao: {},
          avisos: {},
          editadas: [],
        },
      }),
    );
    let entregar: (v: unknown) => void = () => undefined;
    const { user } = renderizar({
      store: comChave(),
      gerar: () =>
        new Promise((resolve) => {
          entregar = resolve;
        }),
    });

    await user.click(screen.getByRole('button', { name: 'Editar seção Resumo' }));
    expect(screen.getByLabelText('Texto da seção Resumo')).toHaveValue('Texto antigo.');

    await user.click(botaoGerar());
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    await act(async () => {
      entregar(resposta('Texto novo da IA.'));
      await Promise.resolve();
    });

    expect(await within(folha()).findByText('Texto novo da IA.')).toBeVisible();
    expect(screen.queryByLabelText('Texto da seção Resumo')).not.toBeInTheDocument();
  });
});

describe('Workbench: acessibilidade', () => {
  it('todo campo e todo botão têm nome acessível; links externos avisam a nova aba', () => {
    salvarRascunho(
      completo({
        resultado: {
          secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Texto.', itens: [] }] },
          encaminhamentos: [],
          atribuicao: {},
          avisos: {},
          editadas: [],
        },
      }),
    );
    renderizar();

    const campos = Array.from(document.querySelectorAll('input, select, textarea')).filter(
      // Oculto (ex.: o seletor de arquivo, acionado pelo botão "Enviar") não está na árvore acessível.
      (el) => el.closest('[hidden]') === null,
    );
    expect(campos.length).toBeGreaterThan(10);
    for (const campo of campos) {
      expect(campo).toHaveAccessibleName();
    }
    for (const botao of screen.getAllByRole('button')) {
      expect(botao).toHaveAccessibleName();
    }
    expect(screen.getByRole('heading', { level: 1, name: 'Lavra' })).toBeInTheDocument();
    for (const link of document.querySelectorAll('a[target="_blank"]')) {
      expect(link).toHaveAccessibleName(/\(abre em nova aba\)$/);
    }
    // Progresso da geração e notificações em regiões que anunciam sem interromper (já presentes
    // antes de anunciar, para o leitor de tela perceber a mudança).
    expect(screen.getByRole('region', { name: 'Notificações' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
    const barra = screen.getByRole('region', { name: 'Gerar ata' });
    expect(barra.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('erro de geração não é mascarado como sucesso nem some com a ata', async () => {
    salvarRascunho(completo());
    const { user } = renderizar({
      store: comChave(),
      gerar: () => Promise.reject(erroProvedor('inesperado', 'openai', { status: 418 })),
    });
    await user.click(botaoGerar());
    expect(await screen.findByRole('alert')).toHaveTextContent('A ata não foi alterada.');
    expect(screen.queryByText(/Ata gerada por/)).not.toBeInTheDocument();
  });
});
