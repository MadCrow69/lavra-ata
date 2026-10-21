import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import { ErroProvedor, erroProvedor } from '../../ai/errors';
import { KeysProvider } from '../../ai/KeysContext';
import { criarKeyStore, type ChaveProvedor } from '../../ai/keys';
import type { GenerateRequest, ProviderAdapter, ProviderConfig, ProviderId } from '../../ai/types';
import { LIMITE_TRANSCRICAO } from '../../config/limits';
import { DraftProvider, useDraft } from '../../domain/DraftContext';
import type { AtaDraft } from '../../domain/draft';
import { CHAVE_AVISOS_GERAIS, criarRascunho } from '../../domain/draft-reducer';
import { OperacaoIAProvider, useOperacaoIA } from '../../generation/OperacaoIA';
import { ToastProvider } from '../../ui/Toast';
import { DadosBlock } from './DadosBlock';
import { GenerateBar } from './GenerateBar';
import { TranscricaoBlock } from './TranscricaoBlock';

const CPF = '529.982.247-25';

type Gerar = (cfg: ProviderConfig, req: GenerateRequest) => Promise<unknown>;

function adaptadores(impl: Partial<Record<ProviderId, Gerar>>) {
  const gerar = {
    openai: vi.fn<Gerar>(impl.openai ?? (() => Promise.reject(new Error('não chamar')))),
    gemini: vi.fn<Gerar>(impl.gemini ?? (() => Promise.reject(new Error('não chamar')))),
    anthropic: vi.fn<Gerar>(impl.anthropic ?? (() => Promise.reject(new Error('não chamar')))),
  };
  const mk = (id: ProviderId): ProviderAdapter => ({
    id,
    rotulo: id,
    gerar: gerar[id],
    testarChave: () => Promise.resolve(),
  });
  return {
    a: { openai: mk('openai'), gemini: mk('gemini'), anthropic: mk('anthropic') },
    gerar,
  };
}

const RESPOSTA = {
  secoes: Object.fromEntries(
    corporativa.secoes.map((s) => [
      s.chave,
      s.chave === 'resumo' ? [{ tipo: 'paragrafo', texto: 'Reembolso a [CPF_1].', itens: [] }] : [],
    ]),
  ),
  encaminhamentos: [],
};

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

const OPENAI: ChaveProvedor = {
  provedor: 'openai',
  chave: 'sk-teste-ficticia-1',
  modelo: 'gpt-6-luna',
  estado: 'ok',
};
const GEMINI: ChaveProvedor = {
  provedor: 'gemini',
  chave: 'AIzaTesteFicticia2',
  modelo: 'gemini-3.8-flash',
  estado: 'ok',
};

/** Mostra no DOM o que importa do rascunho, para conferir que só o sucesso o altera. */
function Espiao() {
  const { state } = useDraft();
  const texto = state.resultado?.secoes.resumo?.[0]?.texto ?? 'sem resultado';
  return <output data-testid="espiao">{texto}</output>;
}

/** Faz o papel do editor da folha: troca o resumo à mão (marca a seção como editada). */
function EdicaoManual() {
  const { dispatch } = useDraft();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({
          type: 'substituirSecao',
          chave: 'resumo',
          blocos: [{ tipo: 'paragrafo', texto: 'Escrito à mão.', itens: [] }],
          avisos: [],
          atribuicao: null,
          mapa: null,
        });
      }}
    >
      Editar o resumo à mão
    </button>
  );
}

interface Opcoes {
  inicial?: AtaDraft;
  chaves?: ChaveProvedor[];
  impl?: Partial<Record<ProviderId, Gerar>>;
  comBlocos?: boolean;
  comEdicao?: boolean;
}

function renderizar({
  inicial = completo(),
  chaves = [],
  impl = {},
  comBlocos = false,
  comEdicao = false,
}: Opcoes = {}) {
  const store = criarKeyStore(null);
  for (const c of chaves) store.definir(c);
  const onConfigurarChaves = vi.fn();
  const onGerada = vi.fn();
  const { a, gerar } = adaptadores(impl);
  render(
    <KeysProvider store={store}>
      <DraftProvider inicial={inicial}>
        <OperacaoIAProvider>
          <ToastProvider>
            {comBlocos ? (
              <>
                <DadosBlock tipo={corporativa} />
                <TranscricaoBlock tipo={corporativa} />
              </>
            ) : null}
            <GenerateBar
              onConfigurarChaves={onConfigurarChaves}
              onGerada={onGerada}
              opcoesCadeia={{ adaptadores: a, esperaRetryMs: 0 }}
            />
            {comEdicao ? <EdicaoManual /> : null}
            <Espiao />
          </ToastProvider>
        </OperacaoIAProvider>
      </DraftProvider>
    </KeysProvider>,
  );
  return { onConfigurarChaves, onGerada, gerar, store, user: userEvent.setup() };
}

const botaoGerar = () => screen.getByRole('button', { name: /Gerar ata/ });

describe('GenerateBar', () => {
  it('falta: botão desabilitado com o resumo do que falta', () => {
    renderizar({
      inicial: completo({ dados: { ...completo().dados, data: '' }, pauta: [] }),
      chaves: [OPENAI],
    });
    expect(botaoGerar()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Falta: Data, Pauta' })).toBeVisible();
    expect(botaoGerar()).toHaveAccessibleDescription(/Falta: Data, Pauta/);
  });

  it('clicar no resumo leva ao primeiro campo, abrindo o bloco recolhido', async () => {
    const { user } = renderizar({
      inicial: completo({ dados: { ...completo().dados, data: '' }, pauta: [] }),
      chaves: [OPENAI],
      comBlocos: true,
    });
    await user.click(screen.getByRole('button', { name: /Dados da reunião/ }));
    expect(screen.getByLabelText(/^Data/)).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Falta: Data, Pauta' }));
    const data = screen.getByLabelText(/^Data/);
    expect(data).toBeVisible();
    expect(data).toHaveFocus();
  });

  it('transcrição acima do limite bloqueia a geração (mesma regra do bloco)', async () => {
    const { user } = renderizar({
      inicial: completo({ transcricao: 'a'.repeat(LIMITE_TRANSCRICAO + 1) }),
      chaves: [OPENAI],
      comBlocos: true,
    });
    expect(botaoGerar()).toBeDisabled();
    expect(screen.getByText('falta: Transcrição dentro do limite')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Falta: Transcrição dentro do limite' }));
    expect(screen.getByLabelText(/Transcrição da reunião/)).toHaveFocus();
  });

  it('sem chave: avisa e o botão abre a configuração de chaves', async () => {
    const { user, onConfigurarChaves, gerar } = renderizar();
    expect(screen.getByText(/Nenhuma chave de IA configurada/)).toBeVisible();
    expect(botaoGerar()).toBeEnabled();
    await user.click(botaoGerar());
    expect(onConfigurarChaves).toHaveBeenCalledTimes(1);
    expect(gerar.openai).not.toHaveBeenCalled();
  });

  it('com chave: mostra para quem envia, o modelo e o próximo da fila', async () => {
    const { user, onConfigurarChaves } = renderizar({ chaves: [OPENAI, GEMINI] });
    expect(screen.getByText('Envia para OpenAI · gpt-6-luna (depois Gemini)')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Trocar/ }));
    expect(onConfigurarChaves).toHaveBeenCalledTimes(1);
  });

  it('gerando: progresso, aviso de tempo e cancelar sem alterar o rascunho', async () => {
    const { user } = renderizar({
      chaves: [OPENAI],
      impl: {
        openai: (_cfg, req) =>
          new Promise((_resolve, reject) => {
            req.signal.addEventListener('abort', () => {
              reject(erroProvedor('cancelado', 'openai'));
            });
          }),
      },
    });
    await user.click(botaoGerar());
    expect(screen.getByRole('progressbar')).toBeVisible();
    expect(screen.getByText('Gerando a ata — pode levar até 2 minutos.')).toBeVisible();
    expect(botaoGerar()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText(/Geração cancelada/)).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('espiao')).toHaveTextContent('sem resultado');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sucesso com fallback: grava a ata e o toast diz quem gerou e quem falhou', async () => {
    const { user, onGerada } = renderizar({
      chaves: [OPENAI, GEMINI],
      impl: {
        openai: () =>
          Promise.reject(new ErroProvedor('limite', 'openai', 'limite', 429, { repetivel: false })),
        gemini: () => Promise.resolve(RESPOSTA),
      },
    });
    await user.click(botaoGerar());
    expect(await screen.findByText('Ata gerada por Gemini · gemini-3.8-flash')).toBeVisible();
    expect(screen.getByText('OpenAI falhou (limite de uso)')).toBeVisible();
    // Avisa a bancada (que leva a pessoa à folha) uma vez, só no sucesso.
    expect(onGerada).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('espiao')).toHaveTextContent(`Reembolso a ${CPF}.`);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('chave recusada no fallback: marcada como inválida e sai da fila (spec 8.1.1)', async () => {
    const { store, user } = renderizar({
      chaves: [OPENAI, GEMINI],
      impl: {
        openai: () => Promise.reject(erroProvedor('chave_invalida', 'openai', { status: 401 })),
        gemini: () => Promise.resolve(RESPOSTA),
      },
    });
    await user.click(botaoGerar());
    expect(await screen.findByTestId('espiao')).toHaveTextContent(`Reembolso a ${CPF}.`);
    expect(store.listar().find((c) => c.provedor === 'openai')?.estado).toBe('invalida');
    expect(store.cadeia().map((c) => c.id)).toEqual(['gemini']);
    expect(screen.getByText(/Envia para Gemini · gemini-3\.8-flash/)).toBeInTheDocument();
  });

  it('chave recusada com a cadeia toda falhando também é marcada; as outras não', async () => {
    const { store, user } = renderizar({
      chaves: [OPENAI, GEMINI],
      impl: {
        openai: () => Promise.reject(erroProvedor('chave_invalida', 'openai', { status: 403 })),
        gemini: () => Promise.reject(erroProvedor('recusa', 'gemini')),
      },
    });
    await user.click(botaoGerar());
    await screen.findByRole('alert');
    const estados = Object.fromEntries(store.listar().map((c) => [c.provedor, c.estado]));
    expect(estados).toEqual({ openai: 'invalida', gemini: 'ok' });
  });

  it('erro: mostra a causa de cada provedor, a ação e "Tentar de novo"', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      chaves: [OPENAI, GEMINI],
      impl: {
        openai: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('muito_longo', 'openai', { modelo: 'gpt-6-luna' }))
            : Promise.resolve(RESPOSTA);
        },
        gemini: () => Promise.reject(erroProvedor('inesperado', 'gemini', { status: 418 })),
      },
    });
    await user.click(botaoGerar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Nenhum provedor conseguiu gerar a ata.');
    expect(alerta).toHaveTextContent(
      'A transcrição ficou grande demais para o modelo gpt-6-luna. Divida a reunião ou escolha um modelo com mais contexto.',
    );
    expect(alerta).toHaveTextContent('Google Gemini recusou a chamada (HTTP 418).');
    expect(screen.getByTestId('espiao')).toHaveTextContent('sem resultado');

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro: "Tentar de novo" respeita o que falta (transcrição passou do limite)', async () => {
    const { user, gerar } = renderizar({
      chaves: [OPENAI],
      comBlocos: true,
      impl: {
        openai: () => Promise.reject(erroProvedor('limite', 'openai', { repetivel: false })),
      },
    });
    await user.click(botaoGerar());
    const alerta = await screen.findByRole('alert');
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/Transcrição da reunião/), {
      target: { value: 'a'.repeat(LIMITE_TRANSCRICAO + 1) },
    });
    const tentar = within(alerta).getByRole('button', { name: 'Tentar de novo' });
    expect(tentar).toBeDisabled();
    expect(tentar).toHaveAccessibleDescription(/Falta: Transcrição dentro do limite/);
    fireEvent.click(tentar);
    expect(gerar.openai).toHaveBeenCalledTimes(1);
  });

  it('erro: a mensagem nunca traz a chave nem o CPF', async () => {
    const { user, onGerada } = renderizar({
      chaves: [OPENAI],
      impl: { openai: () => Promise.reject(new Error(`falhou ${OPENAI.chave} ${CPF}`)) },
    });
    await user.click(botaoGerar());
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).not.toContain(OPENAI.chave);
    expect(alerta.textContent).not.toContain(CPF);
    expect(onGerada).not.toHaveBeenCalled();
  });

  it('regerar tudo com conteúdo existente pede confirmação', async () => {
    const existente = completo({
      resultado: {
        secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Texto antigo.', itens: [] }] },
        encaminhamentos: [],
        atribuicao: {},
        avisos: {},
        editadas: ['resumo'],
      },
    });
    const { user, gerar } = renderizar({
      inicial: existente,
      chaves: [OPENAI],
      impl: { openai: () => Promise.resolve(RESPOSTA) },
    });
    await user.click(botaoGerar());
    const dialogo = screen.getByRole('dialog', { name: 'Gerar a ata de novo?' });
    expect(dialogo).toHaveTextContent(/substitui a ata atual, inclusive as seções editadas à mão/);
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gerar.openai).not.toHaveBeenCalled();

    await user.click(botaoGerar());
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(screen.getByTestId('espiao')).toHaveTextContent(`Reembolso a ${CPF}.`);
  });

  it('"Tentar de novo" depois de editar uma seção pede a mesma confirmação de substituir', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      inicial: completo({
        resultado: {
          secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Texto antigo.', itens: [] }] },
          encaminhamentos: [],
          atribuicao: {},
          avisos: {},
          editadas: [],
        },
      }),
      chaves: [OPENAI],
      comEdicao: true,
      impl: {
        openai: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('recusa', 'openai'))
            : Promise.resolve(RESPOSTA);
        },
      },
    });
    await user.click(botaoGerar());
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    const alerta = await screen.findByRole('alert');

    // A pessoa editou o resumo depois da falha: tentar de novo apagaria a edição.
    await user.click(screen.getByRole('button', { name: 'Editar o resumo à mão' }));
    expect(screen.getByTestId('espiao')).toHaveTextContent('Escrito à mão.');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    const dialogo = screen.getByRole('dialog', { name: 'Gerar a ata de novo?' });
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('espiao')).toHaveTextContent('Escrito à mão.');

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(2);
  });

  it('"Tentar de novo" sem nada editado desde a tentativa confirmada não pergunta de novo', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      inicial: completo({
        resultado: {
          secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Texto antigo.', itens: [] }] },
          encaminhamentos: [],
          atribuicao: {},
          avisos: {},
          editadas: ['resumo'],
        },
      }),
      chaves: [OPENAI],
      impl: {
        openai: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('recusa', 'openai'))
            : Promise.resolve(RESPOSTA);
        },
      },
    });
    await user.click(botaoGerar());
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    const alerta = await screen.findByRole('alert');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(2);
  });

  it('avisos gerais não se repetem na barra (o lugar deles é acima da folha)', () => {
    renderizar({
      chaves: [OPENAI],
      inicial: completo({
        resultado: {
          secoes: {},
          encaminhamentos: [],
          atribuicao: {},
          avisos: {
            [CHAVE_AVISOS_GERAIS]: ['Seu texto já tinha um trecho parecido com um marcador.'],
          },
          editadas: [],
        },
      }),
    });
    expect(
      screen.queryByText('Seu texto já tinha um trecho parecido com um marcador.'),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['o adaptador rejeita ao abortar', 'rejeita'],
    ['o adaptador ignora o abort e responde', 'responde'],
  ] as const)(
    'interrompida por fora ("Nova ata"), sem remontar: %s → nada é gravado nem avisado',
    async (_nome, comportamento) => {
      let entregar: (v: unknown) => void = () => undefined;
      const store = criarKeyStore(null);
      store.definir(OPENAI);
      const { a } = adaptadores({
        openai: (_cfg, req) =>
          new Promise((resolve, reject) => {
            entregar = resolve;
            if (comportamento === 'rejeita') {
              req.signal.addEventListener('abort', () => {
                reject(erroProvedor('cancelado', 'openai'));
              });
            }
          }),
      });
      function Interromper() {
        const { interromper } = useOperacaoIA();
        return (
          <button type="button" onClick={interromper}>
            Interromper
          </button>
        );
      }
      render(
        <KeysProvider store={store}>
          <DraftProvider inicial={completo()}>
            <OperacaoIAProvider>
              <ToastProvider>
                <GenerateBar onConfigurarChaves={vi.fn()} opcoesCadeia={{ adaptadores: a }} />
                <Interromper />
                <Espiao />
              </ToastProvider>
            </OperacaoIAProvider>
          </DraftProvider>
        </KeysProvider>,
      );
      const user = userEvent.setup();
      await user.click(botaoGerar());
      await user.click(screen.getByRole('button', { name: 'Interromper' }));
      await act(async () => {
        entregar(RESPOSTA);
        await Promise.resolve();
      });

      expect(screen.getByTestId('espiao')).toHaveTextContent('sem resultado');
      expect(screen.queryByText(/Ata gerada por/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Geração cancelada/)).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    },
  );

  it('desmontar durante a geração cancela a chamada', async () => {
    let sinal: AbortSignal | null = null;
    const store = criarKeyStore(null);
    store.definir(OPENAI);
    const { a } = adaptadores({
      openai: (_cfg, req) => {
        sinal = req.signal;
        return new Promise(() => undefined);
      },
    });
    const { unmount } = render(
      <KeysProvider store={store}>
        <DraftProvider inicial={completo()}>
          <OperacaoIAProvider>
            <ToastProvider>
              <GenerateBar onConfigurarChaves={vi.fn()} opcoesCadeia={{ adaptadores: a }} />
            </ToastProvider>
          </OperacaoIAProvider>
        </DraftProvider>
      </KeysProvider>,
    );
    await userEvent.setup().click(botaoGerar());
    expect(sinal).not.toBeNull();
    act(() => {
      unmount();
    });
    expect((sinal as AbortSignal | null)?.aborted).toBe(true);
  });
});
