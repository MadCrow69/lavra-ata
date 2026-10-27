import { createMaskMap, mask } from '@lavra/pii-br';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import { ErroProvedor, erroProvedor } from '../../ai/errors';
import { KeysProvider } from '../../ai/KeysContext';
import { criarKeyStore, type ChaveProvedor } from '../../ai/keys';
import type { GenerateRequest, ProviderAdapter, ProviderConfig, ProviderId } from '../../ai/types';
import { LIMITE_TRANSCRICAO } from '../../config/limits';
import { MAX_TRECHOS_SENSIVEIS_VISIVEIS } from '../../config/termos-sensiveis';
import { TEXTO_MOTIVO_REVISAO } from '../../generation/autorizacao';
import { DraftProvider, useDraft } from '../../domain/DraftContext';
import type { AtaDraft } from '../../domain/draft';
import { CHAVE_AVISOS_GERAIS, criarRascunho } from '../../domain/draft-reducer';
import { OperacaoIAProvider, useOperacaoIA } from '../../generation/OperacaoIA';
import { MOTIVO_EXEMPLO } from '../exemplo/ModoExemplo';
import { ModoExemploDeTeste } from '../../test/modo-exemplo';
import { dialogoRevisao, gerarEEnviar } from '../../test/revisao-envio';
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
  /** Ordem escolhida pela pessoa; ausente = a ordem padrão (Gemini primeiro). */
  ordem?: ProviderId[];
  impl?: Partial<Record<ProviderId, Gerar>>;
  comBlocos?: boolean;
  comEdicao?: boolean;
  /** Renderiza dentro do modo exemplo (IA parada). */
  noExemplo?: boolean;
}

/** A pessoa pôs a OpenAI na frente (a escolha dela vence a ordem padrão). */
const OPENAI_PRIMEIRO: ProviderId[] = ['openai', 'gemini', 'anthropic'];

function renderizar({
  inicial = completo(),
  chaves = [],
  ordem,
  impl = {},
  comBlocos = false,
  comEdicao = false,
  noExemplo = false,
}: Opcoes = {}) {
  const store = criarKeyStore(null);
  for (const c of chaves) store.definir(c);
  if (ordem) store.reordenar(ordem);
  const onConfigurarChaves = vi.fn();
  const onGerada = vi.fn();
  const { a, gerar } = adaptadores(impl);
  render(
    <ModoExemploDeTeste ligado={noExemplo}>
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
      </KeysProvider>
    </ModoExemploDeTeste>,
  );
  return { onConfigurarChaves, onGerada, gerar, store, user: userEvent.setup() };
}

const botaoGerar = () => screen.getByRole('button', { name: /Gerar ata/ });

describe('GenerateBar', () => {
  it('modo exemplo: com chave e tudo preenchido, Gerar fica parado com o motivo e nada é chamado', async () => {
    const { user, gerar, onConfigurarChaves } = renderizar({ chaves: [OPENAI], noExemplo: true });
    expect(botaoGerar()).toBeDisabled();
    expect(botaoGerar()).toHaveAccessibleDescription(MOTIVO_EXEMPLO);
    expect(screen.getByText(MOTIVO_EXEMPLO)).toBeVisible();
    // Nada de "Envia para …": no exemplo nada é enviado.
    expect(screen.queryByText(/Envia para/)).not.toBeInTheDocument();
    await user.click(botaoGerar());
    expect(gerar.openai).not.toHaveBeenCalled();
    expect(onConfigurarChaves).not.toHaveBeenCalled();
  });

  it('modo exemplo ligado depois de uma falha: "Tentar de novo" para com o motivo', async () => {
    const { user, gerar } = renderizar({
      chaves: [OPENAI],
      impl: { openai: () => Promise.reject(erroProvedor('rede', 'openai')) },
    });
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');
    const tentar = within(alerta).getByRole('button', { name: 'Tentar de novo' });
    expect(tentar).toBeEnabled();
    gerar.openai.mockClear();

    await user.click(screen.getByRole('button', { name: 'Ligar o modo exemplo' }));
    expect(tentar).toBeDisabled();
    expect(tentar).toHaveAccessibleDescription(MOTIVO_EXEMPLO);
    await user.click(tentar);
    expect(gerar.openai).not.toHaveBeenCalled();
  });

  it('modo exemplo: o motivo vem antes do que falta na descrição do botão', () => {
    renderizar({
      inicial: completo({ pauta: [] }),
      chaves: [OPENAI],
      noExemplo: true,
    });
    expect(botaoGerar()).toHaveAccessibleDescription(`${MOTIVO_EXEMPLO} Falta: Pauta`);
  });

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

  it('sem ordem escolhida, o Gemini vai primeiro (ordem padrão)', () => {
    renderizar({ chaves: [OPENAI, GEMINI] });
    expect(screen.getByText('Envia para Gemini · gemini-3.8-flash (depois OpenAI)')).toBeVisible();
  });

  it('com chave: mostra para quem envia, o modelo e o próximo da fila', async () => {
    const { user, onConfigurarChaves } = renderizar({
      chaves: [OPENAI, GEMINI],
      ordem: OPENAI_PRIMEIRO,
    });
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
    await gerarEEnviar(user);
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
      ordem: OPENAI_PRIMEIRO,
      impl: {
        openai: () =>
          Promise.reject(new ErroProvedor('limite', 'openai', 'limite', 429, { repetivel: false })),
        gemini: () => Promise.resolve(RESPOSTA),
      },
    });
    await gerarEEnviar(user);
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
      ordem: OPENAI_PRIMEIRO,
      impl: {
        openai: () => Promise.reject(erroProvedor('chave_invalida', 'openai', { status: 401 })),
        gemini: () => Promise.resolve(RESPOSTA),
      },
    });
    await gerarEEnviar(user);
    expect(await screen.findByTestId('espiao')).toHaveTextContent(`Reembolso a ${CPF}.`);
    expect(store.listar().find((c) => c.provedor === 'openai')?.estado).toBe('invalida');
    expect(store.cadeia().map((c) => c.id)).toEqual(['gemini']);
    expect(screen.getByText(/Envia para Gemini · gemini-3\.8-flash/)).toBeInTheDocument();
  });

  it('chave recusada com a cadeia toda falhando também é marcada; as outras não', async () => {
    const { store, user } = renderizar({
      chaves: [OPENAI, GEMINI],
      ordem: OPENAI_PRIMEIRO,
      impl: {
        openai: () => Promise.reject(erroProvedor('chave_invalida', 'openai', { status: 403 })),
        gemini: () => Promise.reject(erroProvedor('recusa', 'gemini')),
      },
    });
    await gerarEEnviar(user);
    await screen.findByRole('alert');
    const estados = Object.fromEntries(store.listar().map((c) => [c.provedor, c.estado]));
    expect(estados).toEqual({ openai: 'invalida', gemini: 'ok' });
  });

  it('erro: mostra a causa de cada provedor, a ação e "Tentar de novo"', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      chaves: [OPENAI, GEMINI],
      ordem: OPENAI_PRIMEIRO,
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
    await gerarEEnviar(user);
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
    await gerarEEnviar(user);
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
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).not.toContain(OPENAI.chave);
    expect(alerta.textContent).not.toContain(CPF);
    expect(onGerada).not.toHaveBeenCalled();
  });

  it('"Gerar ata" abre a revisão e nada sai; Cancelar fecha sem chamar; Enviar chama uma vez', async () => {
    const { user, gerar } = renderizar({
      chaves: [OPENAI, GEMINI],
      ordem: OPENAI_PRIMEIRO,
      impl: { openai: () => Promise.resolve(RESPOSTA) },
    });
    await user.click(botaoGerar());
    const dialogo = await dialogoRevisao();
    expect(gerar.openai).not.toHaveBeenCalled();
    expect(dialogo).toHaveTextContent(
      'Isto sai do seu navegador para OpenAI · gpt-6-luna (se falhar, para Gemini).',
    );
    expect(dialogo).toHaveTextContent('Nomes de pessoas não são removidos — a ata precisa deles.');
    // Sem ata gerada: nada de aviso de substituição.
    expect(dialogo).not.toHaveTextContent(/substitui a ata atual/);
    const conteudo = within(dialogo).getByRole('region', { name: 'Conteúdo enviado à IA' });
    expect(conteudo).toHaveAttribute('tabindex', '0');
    expect(conteudo).not.toHaveTextContent(CPF);
    // Só o marcador do CPF real (na transcrição) é destacado; o exemplo fixo do cabeçalho
    // ("marcadores como [CPF_1]") fica como texto comum.
    const marcas = within(conteudo).getAllByText('[CPF_1]');
    expect(marcas).toHaveLength(1);
    expect(marcas[0]?.tagName).toBe('MARK');
    expect(marcas[0]?.closest('[data-testid="conteudo-enviado"]')).toBe(conteudo);
    expect(conteudo.textContent).toContain(`Ana: reembolso ao CPF [CPF_1].`);
    expect(conteudo).toHaveTextContent('Ana Souza');
    expect(conteudo).toHaveTextContent('Reembolsos');

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gerar.openai).not.toHaveBeenCalled();
    expect(botaoGerar()).toHaveFocus();

    await user.click(botaoGerar());
    await user.click(
      within(await dialogoRevisao()).getByRole('button', { name: 'Enviar para a IA' }),
    );
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(1);
  });

  it('Esc também cancela sem enviar', async () => {
    const { user, gerar } = renderizar({ chaves: [OPENAI] });
    await user.click(botaoGerar());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gerar.openai).not.toHaveBeenCalled();
  });

  it('o conteúdo revisado é exatamente o que o provedor recebe', async () => {
    const { user, gerar } = renderizar({
      chaves: [OPENAI],
      inicial: completo({ pauta: [`Cadastro do CPF ${CPF}`] }),
      impl: { openai: () => Promise.resolve(RESPOSTA) },
    });
    await user.click(botaoGerar());
    const revisado = within(await dialogoRevisao()).getByRole('region', {
      name: 'Conteúdo enviado à IA',
    }).textContent;
    const instrucoes = screen.getByTestId('instrucoes-enviadas').textContent;
    await user.click(
      within(await dialogoRevisao()).getByRole('button', { name: 'Enviar para a IA' }),
    );
    await screen.findByText('Ata gerada por OpenAI · gpt-6-luna');
    expect(gerar.openai.mock.calls[0]?.[1].usuario).toBe(revisado);
    expect(gerar.openai.mock.calls[0]?.[1].sistema).toBe(instrucoes);
  });

  it('as instruções fixas ficam recolhidas num <details> com o resumo do que são', async () => {
    const { user } = renderizar({ chaves: [OPENAI] });
    await user.click(botaoGerar());
    const resumo = within(await dialogoRevisao()).getByText(
      'Instruções do Lavra enviadas junto (iguais em toda ata deste tipo e tom, sem dados da reunião)',
    );
    const detalhes = resumo.closest('details');
    expect(detalhes).not.toBeNull();
    expect(detalhes).not.toHaveAttribute('open');
    expect(screen.getByTestId('instrucoes-enviadas')).not.toHaveTextContent(CPF);
  });

  it('termo sensível na transcrição: aviso com categorias e trechos, sem mascarar', async () => {
    const { user } = renderizar({
      chaves: [OPENAI],
      inicial: completo({
        transcricao:
          'Ana: a Joana está afastada por depressão; o Carlos entrou com processo trabalhista.',
      }),
    });
    await user.click(botaoGerar());
    const dialogo = await dialogoRevisao();
    const aviso = within(dialogo).getByRole('region', {
      name: 'Possível dado sensível (saúde, conflito trabalhista)',
    });
    expect(
      within(aviso)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'afastada por (saúde)',
      'depressão (saúde)',
      'processo trabalhista (conflito trabalhista)',
    ]);
    expect(aviso).toHaveTextContent(
      'Não são mascarados. Se não forem necessários para a ata, cancele e edite a transcrição.',
    );
    expect(aviso).toHaveTextContent(/lista de palavras, não é uma proteção/);
    const conteudo = within(dialogo).getByRole('region', { name: 'Conteúdo enviado à IA' });
    expect(within(conteudo).getByText('depressão').tagName).toBe('MARK');
    expect(conteudo).toHaveTextContent('a Joana está afastada por depressão');
  });

  it('muitos trechos sensíveis: lista os primeiros e resume o resto em "e mais N"', async () => {
    const termos = [
      'atestado médico',
      'cirurgia',
      'gravidez',
      'burnout',
      'ansiedade',
      'internação',
      'medicamento',
      'doença',
      'sindicato',
      'religião',
    ];
    const { user } = renderizar({
      chaves: [OPENAI],
      inicial: completo({ transcricao: `Ana: ${termos.join(', ')}, atestado médico de novo.` }),
    });
    await user.click(botaoGerar());
    const aviso = within(await dialogoRevisao()).getByRole('region', {
      name: /Possível dado sensível/,
    });
    expect(within(aviso).getAllByRole('listitem')).toHaveLength(MAX_TRECHOS_SENSIVEIS_VISIVEIS);
    expect(aviso).toHaveTextContent(
      `e mais ${String(termos.length - MAX_TRECHOS_SENSIVEIS_VISIVEIS)} trechos`,
    );
  });

  it('sem termo sensível, o bloco de aviso não aparece', async () => {
    const { user } = renderizar({ chaves: [OPENAI] });
    await user.click(botaoGerar());
    expect(
      within(await dialogoRevisao()).queryByRole('region', { name: /Possível dado sensível/ }),
    ).not.toBeInTheDocument();
  });

  it('com ata gerada, o aviso de substituir está no mesmo diálogo (um só) e o botão diz isso', async () => {
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
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const dialogo = await dialogoRevisao();
    expect(dialogo).toHaveTextContent(/substitui a ata atual, inclusive as seções editadas à mão/);
    expect(within(dialogo).getByRole('region', { name: 'Conteúdo enviado à IA' })).toBeVisible();
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(gerar.openai).not.toHaveBeenCalled();
    expect(screen.getByTestId('espiao')).toHaveTextContent('Texto antigo.');

    await user.click(botaoGerar());
    await user.click(
      within(await dialogoRevisao()).getByRole('button', { name: 'Enviar e substituir a ata' }),
    );
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('espiao')).toHaveTextContent(`Reembolso a ${CPF}.`);
  });

  it('colisão de marcador aparece como aviso na revisão', async () => {
    const { user } = renderizar({
      chaves: [OPENAI],
      inicial: completo({
        // Mapa de uma geração anterior: o [CPF_1] digitado colide com o marcador que já existe.
        mapa: mask(`CPF ${CPF}`, { map: createMaskMap() }).map,
        transcricao: 'Ana: o campo aparecia como [CPF_1] no sistema antigo.',
      }),
    });
    await user.click(botaoGerar());
    expect(await dialogoRevisao()).toHaveTextContent(
      'Atenção: [CPF_1] já aparece no texto como se fosse um marcador',
    );
  });

  it('"Tentar de novo" com o mesmo conteúdo e a ata intacta envia direto, sem reabrir a revisão', async () => {
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
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(2);
  });

  it('"Tentar de novo" com a transcrição mudada reabre a revisão com o conteúdo novo', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      chaves: [OPENAI],
      comBlocos: true,
      impl: {
        openai: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('recusa', 'openai'))
            : Promise.resolve(RESPOSTA);
        },
      },
    });
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');
    fireEvent.change(screen.getByLabelText(/Transcrição da reunião/), {
      target: { value: 'Ana: a Joana está afastada desde março.' },
    });
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    const dialogo = await dialogoRevisao();
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    // A revisão reaberta diz por quê.
    expect(dialogo).toHaveTextContent(TEXTO_MOTIVO_REVISAO.conteudo ?? '');
    expect(
      within(dialogo).getByRole('region', { name: 'Conteúdo enviado à IA' }),
    ).toHaveTextContent('a Joana está afastada desde março.');
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar para a IA' }));
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(2);
  });

  it('"Cancelar" numa revisão revoga a autorização: "Tentar de novo" reabre em vez de enviar', async () => {
    const { user, gerar } = renderizar({
      chaves: [OPENAI],
      impl: { openai: () => Promise.reject(erroProvedor('recusa', 'openai')) },
    });
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    // A pessoa abre a revisão de novo, vê o conteúdo e desiste.
    await user.click(botaoGerar());
    await user.click(within(await dialogoRevisao()).getByRole('button', { name: 'Cancelar' }));
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    const dialogo = await dialogoRevisao();
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    // Primeira revisão depois da revogação: sem linha de "mudou".
    expect(dialogo).not.toHaveTextContent(TEXTO_MOTIVO_REVISAO.conteudo ?? '');
  });

  it('a primeira revisão não traz linha de "mudou"', async () => {
    const { user } = renderizar({ chaves: [OPENAI] });
    await user.click(botaoGerar());
    const dialogo = await dialogoRevisao();
    for (const texto of Object.values(TEXTO_MOTIVO_REVISAO)) {
      if (texto !== null) expect(dialogo).not.toHaveTextContent(texto);
    }
  });

  it('"Tentar de novo" depois de editar uma seção reabre a revisão com o aviso de substituir', async () => {
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
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');

    // A pessoa editou o resumo depois da falha: tentar de novo apagaria a edição.
    await user.click(screen.getByRole('button', { name: 'Editar o resumo à mão' }));
    expect(screen.getByTestId('espiao')).toHaveTextContent('Escrito à mão.');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    const dialogo = await dialogoRevisao();
    expect(dialogo).toHaveTextContent(/substitui a ata atual, inclusive as seções editadas à mão/);
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('espiao')).toHaveTextContent('Escrito à mão.');

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    await user.click(
      within(await dialogoRevisao()).getByRole('button', { name: 'Enviar e substituir a ata' }),
    );
    expect(await screen.findByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible();
    expect(gerar.openai).toHaveBeenCalledTimes(2);
  });

  it('"Tentar de novo" com um provedor novo na fila reabre a revisão (destino não autorizado)', async () => {
    const { user, gerar, store } = renderizar({
      chaves: [OPENAI],
      impl: {
        openai: () => Promise.reject(erroProvedor('recusa', 'openai')),
        gemini: () => Promise.resolve(RESPOSTA),
      },
    });
    await gerarEEnviar(user);
    const alerta = await screen.findByRole('alert');
    act(() => {
      store.definir(GEMINI);
    });
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(await dialogoRevisao()).toHaveTextContent('Isto sai do seu navegador para Gemini');
    expect(gerar.gemini).not.toHaveBeenCalled();
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
      await gerarEEnviar(user);
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
    await gerarEEnviar(userEvent.setup());
    expect(sinal).not.toBeNull();
    act(() => {
      unmount();
    });
    expect((sinal as AbortSignal | null)?.aborted).toBe(true);
  });
});
