import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { erroProvedor } from '../../ai/errors';
import { criarKeyStore, type ChaveProvedor } from '../../ai/keys';
import type { GenerateRequest, ProviderAdapter, ProviderConfig, ProviderId } from '../../ai/types';
import { LIMITE_INSTRUCAO } from '../../config/limits';
import { useDraft } from '../../domain/DraftContext';
import type { Atribuicao, AtaDraft, ResultadoAta } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { GenerateBar } from '../form/GenerateBar';
import { A4Preview } from './A4Preview';
import { renderizarComProvedores } from '../../test/provedores';
import { TEMPO_VOLUME_MS } from '../../test/tempos';

const CPF_NA_TRANSCRICAO = '529.982.247-25';
const CPF_INVENTADO = '111.444.777-35';

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

const GEMINI: ChaveProvedor = {
  provedor: 'gemini',
  chave: 'AIzaTesteFicticia2',
  modelo: 'gemini-3.8-flash',
  estado: 'ok',
};

const ATRIBUICAO_OPENAI: Atribuicao = { provedor: 'openai', modelo: 'gpt-6-luna', falhas: [] };

function resultado(parcial: Partial<ResultadoAta> = {}): ResultadoAta {
  return {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: 'Foi tratado o reembolso.', itens: [] }],
      discussao: [{ tipo: 'paragrafo', texto: 'A discussão foi longa.', itens: [] }],
      decisoes: [{ tipo: 'lista', texto: 'Ficou decidido:', itens: ['Aprovar', 'Adiar a compra'] }],
      pendencias: [],
      riscos: [],
      proxima_reuniao: [],
    },
    encaminhamentos: [
      {
        acao: 'Enviar a planilha',
        responsavel: 'Ana Souza',
        prazo: '2026-10-30',
        status: 'em_andamento',
      },
      { acao: 'Revisar o contrato', responsavel: 'A definir', prazo: '', status: 'pendente' },
    ],
    atribuicao: {
      resumo: ATRIBUICAO_OPENAI,
      discussao: ATRIBUICAO_OPENAI,
      decisoes: ATRIBUICAO_OPENAI,
      encaminhamentos: ATRIBUICAO_OPENAI,
    },
    avisos: {},
    editadas: [],
    ...parcial,
  };
}

function rascunho(parcial: Partial<AtaDraft> = {}): AtaDraft {
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
    transcricao: `Ana: o reembolso vai para o CPF ${CPF_NA_TRANSCRICAO}.`,
    resultado: resultado(),
    ...parcial,
  };
}

/** Expõe o resultado do rascunho no DOM, para conferir o que mudou e o que não mudou. */
function Espiao() {
  const { state } = useDraft();
  return <output data-testid="espiao">{JSON.stringify(state.resultado)}</output>;
}

const lerResultado = (): ResultadoAta =>
  JSON.parse(screen.getByTestId('espiao').textContent) as ResultadoAta;

/** Troca o resumo à mão por fora da seção (como faria outra superfície de edição). */
function EdicaoPorFora() {
  const { dispatch } = useDraft();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({
          type: 'substituirSecao',
          chave: 'resumo',
          blocos: [{ tipo: 'paragrafo', texto: 'Escrito à mão por fora.', itens: [] }],
          avisos: [],
          atribuicao: null,
          mapa: null,
        });
      }}
    >
      Editar o resumo por fora
    </button>
  );
}

interface Opcoes {
  inicial?: AtaDraft;
  chaves?: ChaveProvedor[];
  impl?: Partial<Record<ProviderId, Gerar>>;
  comBarra?: boolean;
  comEdicaoPorFora?: boolean;
}

function renderizar({
  inicial = rascunho(),
  chaves = [GEMINI],
  impl = {},
  comBarra,
  comEdicaoPorFora,
}: Opcoes = {}) {
  const store = criarKeyStore(null);
  for (const c of chaves) store.definir(c);
  const { a, gerar } = adaptadores(impl);
  const opcoesCadeia = { adaptadores: a, esperaRetryMs: 0 };
  renderizarComProvedores(
    <>
      {comBarra ? <GenerateBar onConfigurarChaves={vi.fn()} opcoesCadeia={opcoesCadeia} /> : null}
      <A4Preview opcoesCadeia={opcoesCadeia} />
      {comEdicaoPorFora ? <EdicaoPorFora /> : null}
      <Espiao />
    </>,
    { inicial, keyStore: store },
  );
  return { gerar, store, user: userEvent.setup() };
}

const secao = (titulo: string) => screen.getByRole('region', { name: titulo });
const MOTIVO_OCUPADA = 'Aguarde a geração em andamento terminar.';
const MOTIVO_SEM_CHAVE = 'Configure uma chave de IA para usar esta ação.';

const respostaBlocos = (texto: string) => ({
  blocos: [{ tipo: 'paragrafo', texto, itens: [] }],
});

/** Chamada que só termina quando é cancelada. */
function pendente() {
  const gerar: Gerar = (_cfg, req) =>
    new Promise((_resolve, reject) => {
      req.signal.addEventListener('abort', () => {
        reject(erroProvedor('cancelado', 'gemini'));
      });
    });
  return { gerar };
}

describe('revisão por seção: ações e atribuição', () => {
  it('cada seção gerada tem Editar, Regerar e Ajustar com o nome da seção', () => {
    renderizar();
    for (const titulo of ['Resumo', 'Discussão por item de pauta', 'Decisões', 'Encaminhamentos']) {
      const s = secao(titulo);
      expect(within(s).getByRole('button', { name: `Editar seção ${titulo}` })).toBeEnabled();
      expect(within(s).getByRole('button', { name: `Regerar seção ${titulo}` })).toBeEnabled();
      expect(
        within(s).getByRole('button', { name: `Ajustar seção ${titulo} com instrução` }),
      ).toBeEnabled();
    }
  });

  it('mostra quem gerou a seção e, depois de editar à mão, "Editado por você"', () => {
    renderizar({
      inicial: rascunho({ resultado: resultado({ editadas: ['discussao'] }) }),
    });
    expect(within(secao('Resumo')).getByText('Gerado por OpenAI · gpt-6-luna')).toBeVisible();
    const editada = secao('Discussão por item de pauta');
    expect(within(editada).getByText('Editado por você')).toBeVisible();
    expect(within(editada).queryByText(/Gerado por/)).not.toBeInTheDocument();
  });

  it('fallback: a atribuição da seção diz quem falhou e por quê (spec 8.1.1)', () => {
    renderizar({
      inicial: rascunho({
        resultado: resultado({
          atribuicao: {
            ...resultado().atribuicao,
            resumo: {
              provedor: 'gemini',
              modelo: 'gemini-3.8-flash',
              falhas: [{ provedor: 'openai', erro: 'limite' }],
            },
            decisoes: {
              provedor: 'gemini',
              modelo: 'gemini-3.8-flash',
              falhas: [{ provedor: 'openai' }],
            },
          },
        }),
      }),
    });
    expect(
      within(secao('Resumo')).getByText(
        'Gerado por Gemini · gemini-3.8-flash — OpenAI falhou (limite de uso)',
      ),
    ).toBeVisible();
    // Rascunho de versão anterior: sem o motivo gravado, diz só que falhou.
    expect(
      within(secao('Decisões')).getByText('Gerado por Gemini · gemini-3.8-flash — OpenAI falhou'),
    ).toBeVisible();
  });

  it('avisos de validação aparecem na seção certa, com ícone e texto', () => {
    renderizar({
      inicial: rascunho({
        resultado: resultado({
          avisos: { discussao: ['A IA citou um CPF que não estava na transcrição — confira.'] },
        }),
      }),
    });
    const aviso = within(secao('Discussão por item de pauta')).getByRole('note');
    expect(aviso).toHaveTextContent('A IA citou um CPF que não estava na transcrição — confira.');
    expect(aviso.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(within(secao('Resumo')).queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('revisão por seção: editar', () => {
  it('editar e salvar atualiza o rascunho e a folha, e marca a seção como editada', async () => {
    const { user } = renderizar();
    const s = secao('Decisões');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Decisões' }));
    const campo = within(s).getByRole('textbox', { name: 'Texto da seção Decisões' });
    expect(campo).toHaveValue('Ficou decidido:\n- Aprovar\n- Adiar a compra');
    expect(campo).toHaveFocus();

    await user.clear(campo);
    await user.type(campo, 'Aprovado por todos.{Enter}{Enter}- Comprar{Enter}- Pagar');
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));

    expect(within(s).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(s).getByText('Aprovado por todos.')).toBeVisible();
    expect(within(s).getByText('Comprar')).toBeVisible();
    expect(within(s).getByText('Editado por você')).toBeVisible();
    const r = lerResultado();
    expect(r.secoes.decisoes).toEqual([
      { tipo: 'paragrafo', texto: 'Aprovado por todos.', itens: [] },
      { tipo: 'lista', texto: '', itens: ['Comprar', 'Pagar'] },
    ]);
    expect(r.editadas).toEqual(['decisoes']);
    expect(r.secoes.resumo).toEqual(resultado().secoes.resumo);
    expect(within(s).getByRole('button', { name: 'Editar seção Decisões' })).toHaveFocus();
  });

  it('Esc cancela sem alterar nada e devolve o foco ao botão Editar', async () => {
    const { user } = renderizar();
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    const campo = within(s).getByRole('textbox', { name: 'Texto da seção Resumo' });
    await user.type(campo, ' Texto que não deve ficar.');
    await user.keyboard('{Escape}');

    expect(within(s).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(s).getByText('Foi tratado o reembolso.')).toBeVisible();
    expect(lerResultado()).toEqual(resultado());
    expect(within(s).getByRole('button', { name: 'Editar seção Resumo' })).toHaveFocus();
  });

  it('Cancelar descarta o que foi digitado e não marca a seção como editada', async () => {
    const { user } = renderizar();
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    await user.type(
      within(s).getByRole('textbox', { name: 'Texto da seção Resumo' }),
      ' Texto descartado.',
    );
    await user.click(within(s).getByRole('button', { name: 'Cancelar' }));
    expect(within(s).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(s).getByText('Foi tratado o reembolso.')).toBeVisible();
    expect(lerResultado()).toEqual(resultado());
    expect(within(s).getByRole('button', { name: 'Editar seção Resumo' })).toHaveFocus();
  });

  it('salvar sem mudar nada não marca a seção como editada', async () => {
    const { user } = renderizar();
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));
    expect(lerResultado().editadas).toEqual([]);
    expect(within(s).getByText('Gerado por OpenAI · gpt-6-luna')).toBeVisible();
  });

  it('apagar todo o texto e salvar remove a seção da folha e deixa o marcador', async () => {
    const { user } = renderizar();
    const s = secao('Decisões');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Decisões' }));
    await user.clear(within(s).getByRole('textbox', { name: 'Texto da seção Decisões' }));
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));

    expect(lerResultado().secoes.decisoes).toEqual([]);
    expect(lerResultado().editadas).toEqual(['decisoes']);
    expect(within(s).queryByText('Aprovar')).not.toBeInTheDocument();
    expect(within(s).getByText('Seção sem conteúdo')).toBeVisible();
    expect(within(s).queryByText('Editado por você')).not.toBeInTheDocument();
    expect(within(s).getByRole('button', { name: 'Escrever seção Decisões' })).toHaveFocus();
  });

  it('a dica do formato do texto está ligada ao campo', async () => {
    const { user } = renderizar();
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    expect(
      within(s).getByRole('textbox', { name: 'Texto da seção Resumo' }),
    ).toHaveAccessibleDescription(/linha em branco.*“- ”.*parágrafo depois da lista/);
  });
});

describe('revisão por seção: regerar e ajustar', () => {
  it('regerar manda o texto atual (inclusive edição manual) e troca só aquela seção', async () => {
    const { user, gerar } = renderizar({
      inicial: rascunho({
        resultado: resultado({
          secoes: {
            ...resultado().secoes,
            resumo: [{ tipo: 'paragrafo', texto: 'Resumo editado por mim.', itens: [] }],
          },
          editadas: ['resumo'],
        }),
      }),
      impl: { gemini: () => Promise.resolve(respostaBlocos('Resumo novo da IA.')) },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Regerar e substituir' }),
    );

    expect(await within(s).findByText('Resumo novo da IA.')).toBeVisible();
    expect(gerar.gemini).toHaveBeenCalledTimes(1);
    const pedido = gerar.gemini.mock.calls[0]?.[1];
    expect(pedido?.usuario).toContain('Resumo editado por mim.');
    expect(pedido?.usuario).toContain('Instrução da pessoa: nenhuma');

    const r = lerResultado();
    expect(r.secoes.resumo).toEqual([
      { tipo: 'paragrafo', texto: 'Resumo novo da IA.', itens: [] },
    ]);
    expect(r.secoes.discussao).toEqual(resultado().secoes.discussao);
    expect(r.encaminhamentos).toEqual(resultado().encaminhamentos);
    expect(r.atribuicao.resumo).toEqual({
      provedor: 'gemini',
      modelo: 'gemini-3.8-flash',
      falhas: [],
    });
    expect(r.atribuicao.discussao).toEqual(ATRIBUICAO_OPENAI);
    expect(r.editadas).toEqual([]);
    expect(within(s).getByText('Gerado por Gemini · gemini-3.8-flash')).toBeVisible();
    expect(screen.getByText(/Seção “Resumo” regerada por Gemini/)).toBeVisible();
  });

  it('regerar com fallback: a seção e o toast dizem quem falhou e o motivo', async () => {
    const { user } = renderizar({
      chaves: [
        { provedor: 'openai', chave: 'sk-teste-ficticia-1', modelo: 'gpt-6-luna', estado: 'ok' },
        GEMINI,
      ],
      impl: {
        openai: () => Promise.reject(erroProvedor('limite', 'openai')),
        gemini: () => Promise.resolve(respostaBlocos('Resumo do segundo provedor.')),
      },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    expect(await within(s).findByText('Resumo do segundo provedor.')).toBeVisible();
    expect(lerResultado().atribuicao.resumo).toEqual({
      provedor: 'gemini',
      modelo: 'gemini-3.8-flash',
      falhas: [{ provedor: 'openai', erro: 'limite' }],
    });
    expect(
      within(s).getByText('Gerado por Gemini · gemini-3.8-flash — OpenAI falhou (limite de uso)'),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Notificações' })).toHaveTextContent(
      'OpenAI falhou (limite de uso)',
    );
  });

  it('seção editada pede confirmação antes de regerar; cancelar não chama a IA', async () => {
    const { user, gerar } = renderizar({
      inicial: rascunho({ resultado: resultado({ editadas: ['resumo'] }) }),
      impl: { gemini: () => Promise.resolve(respostaBlocos('Novo.')) },
    });
    const regerar = within(secao('Resumo')).getByRole('button', { name: 'Regerar seção Resumo' });
    await user.click(regerar);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(
      'Você editou esta seção. Regerar vai substituir suas edições.',
    );
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gerar.gemini).not.toHaveBeenCalled();
    expect(regerar).toHaveFocus();
  });

  it('seção não editada regera direto, sem confirmação', async () => {
    const { user, gerar } = renderizar({
      impl: { gemini: () => Promise.resolve(respostaBlocos('Novo.')) },
    });
    await user.click(within(secao('Resumo')).getByRole('button', { name: 'Regerar seção Resumo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await within(secao('Resumo')).findByText('Novo.')).toBeVisible();
    expect(gerar.gemini).toHaveBeenCalledTimes(1);
  });

  it('ajustar envia a instrução digitada, com contador e limite', async () => {
    const { user, gerar } = renderizar({
      impl: { gemini: () => Promise.resolve(respostaBlocos('Versão curta.')) },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Ajustar seção Resumo com instrução' }));
    const campo = within(s).getByRole('textbox', { name: 'Instrução para a seção Resumo' });
    expect(campo).toHaveFocus();
    expect(campo).toHaveAttribute('maxlength', String(LIMITE_INSTRUCAO));
    expect(campo).toHaveAttribute('placeholder', expect.stringContaining('Deixe mais curto'));
    expect(campo).toHaveAttribute('placeholder', expect.stringContaining('Destaque os prazos'));
    expect(within(s).getByRole('button', { name: 'Aplicar ajuste' })).toBeDisabled();

    await user.type(campo, 'Deixe mais curto');
    expect(within(s).getByText(`16 / ${LIMITE_INSTRUCAO.toLocaleString('pt-BR')}`)).toBeVisible();
    await user.click(within(s).getByRole('button', { name: 'Aplicar ajuste' }));

    expect(await within(s).findByText('Versão curta.')).toBeVisible();
    const pedido = gerar.gemini.mock.calls[0]?.[1];
    expect(pedido?.usuario).toContain('Deixe mais curto');
    expect(pedido?.usuario).toContain('Foi tratado o reembolso.');
    // O painel fecha ao concluir, e o foco volta ao botão que o abriu.
    expect(within(s).queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      within(s).getByRole('button', { name: 'Ajustar seção Resumo com instrução' }),
    ).toHaveFocus();
  });

  it('Esc fecha o campo de instrução sem chamar a IA', async () => {
    const { user, gerar } = renderizar();
    const s = secao('Resumo');
    const ajustar = within(s).getByRole('button', { name: 'Ajustar seção Resumo com instrução' });
    await user.click(ajustar);
    await user.keyboard('{Escape}');
    expect(within(s).queryByRole('textbox')).not.toBeInTheDocument();
    expect(ajustar).toHaveFocus();
    expect(gerar.gemini).not.toHaveBeenCalled();
  });

  it('identificador inventado na seção regerada vira aviso só naquela seção', async () => {
    const { user } = renderizar({
      impl: {
        gemini: () => Promise.resolve(respostaBlocos(`Pagar ao CPF ${CPF_INVENTADO}.`)),
      },
    });
    await user.click(within(secao('Resumo')).getByRole('button', { name: 'Regerar seção Resumo' }));
    const aviso = await within(secao('Resumo')).findByRole('note');
    expect(aviso).toHaveTextContent(/A IA citou um CPF que não estava na transcrição/);
    expect(within(secao('Decisões')).queryByRole('note')).not.toBeInTheDocument();
  });

  it('falha de todos os provedores: causa, ação, seção intacta e "Tentar de novo"', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      impl: {
        gemini: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('muito_longo', 'gemini', { modelo: 'gemini-3.8-flash' }))
            : Promise.resolve(respostaBlocos('Agora foi.'));
        },
      },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    const alerta = await within(s).findByRole('alert');
    expect(alerta).toHaveTextContent('Nenhum provedor conseguiu gerar a seção.');
    expect(alerta).toHaveTextContent(/A transcrição ficou grande demais para o modelo/);
    expect(alerta).toHaveTextContent('A seção não foi alterada.');
    expect(within(s).getByText('Foi tratado o reembolso.')).toBeVisible();
    expect(lerResultado()).toEqual(resultado());

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(s).findByText('Agora foi.')).toBeVisible();
    expect(gerar.gemini).toHaveBeenCalledTimes(2);
    expect(within(s).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('chave recusada ao regerar a seção é marcada como inválida no modal de chaves', async () => {
    const { user, store } = renderizar({
      impl: { gemini: () => Promise.reject(erroProvedor('chave_invalida', 'gemini')) },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    await within(s).findByRole('alert');
    expect(store.listar()[0]?.estado).toBe('invalida');
    expect(store.cadeia()).toEqual([]);
  });

  it('"Tentar de novo" com a seção editada desde a falha pede a confirmação de substituir', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      comEdicaoPorFora: true,
      impl: {
        gemini: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('recusa', 'gemini'))
            : Promise.resolve(respostaBlocos('Regerado.'));
        },
      },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    const alerta = await within(s).findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Editar o resumo por fora' }));
    expect(within(s).getByText('Escrito à mão por fora.')).toBeVisible();

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    const dialogo = screen.getByRole('dialog', { name: 'Regerar esta seção?' });
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(gerar.gemini).toHaveBeenCalledTimes(1);
    expect(within(s).getByText('Escrito à mão por fora.')).toBeVisible();

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    await user.click(screen.getByRole('button', { name: 'Regerar e substituir' }));
    expect(await within(s).findByText('Regerado.')).toBeVisible();
    expect(gerar.gemini).toHaveBeenCalledTimes(2);
  });

  it('"Tentar de novo" de uma seção editada já confirmada não pergunta outra vez', async () => {
    let tentativas = 0;
    const { user, gerar } = renderizar({
      inicial: rascunho({ resultado: resultado({ editadas: ['resumo'] }) }),
      impl: {
        gemini: () => {
          tentativas++;
          return tentativas === 1
            ? Promise.reject(erroProvedor('recusa', 'gemini'))
            : Promise.resolve(respostaBlocos('Regerado.'));
        },
      },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    await user.click(screen.getByRole('button', { name: 'Regerar e substituir' }));
    const alerta = await within(s).findByRole('alert');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await within(s).findByText('Regerado.')).toBeVisible();
    expect(gerar.gemini).toHaveBeenCalledTimes(2);
  });

  it('a mensagem de erro nunca traz a chave nem o CPF', async () => {
    const { user } = renderizar({
      impl: {
        gemini: () => Promise.reject(new Error(`falhou ${GEMINI.chave} ${CPF_NA_TRANSCRICAO}`)),
      },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    const alerta = await within(s).findByRole('alert');
    expect(alerta.textContent).not.toContain(GEMINI.chave);
    expect(alerta.textContent).not.toContain(CPF_NA_TRANSCRICAO);
  });

  it('resposta sem nenhum texto não apaga a seção: mantém o texto e avisa', async () => {
    const { user } = renderizar({
      impl: { gemini: () => Promise.resolve({ blocos: [] }) },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    expect(await within(s).findByRole('alert')).toHaveTextContent(/devolveu a seção vazia/);
    expect(lerResultado()).toEqual(resultado());
  });
});

describe('revisão por seção: uma operação de IA por vez', () => {
  it('durante o busy de uma seção: progresso e Cancelar nela; IA das outras desabilitada com motivo; edição manual livre', async () => {
    const espera = pendente();
    const { user } = renderizar({ impl: { gemini: espera.gerar }, comBarra: true });
    const resumo = secao('Resumo');
    await user.click(within(resumo).getByRole('button', { name: 'Regerar seção Resumo' }));

    expect(within(resumo).getByRole('progressbar')).toBeVisible();
    const cancelar = within(resumo).getByRole('button', {
      name: 'Cancelar regeração da seção Resumo',
    });
    expect(cancelar).toHaveFocus();
    // Na própria seção, editar também fica parado (o resultado vai substituí-la).
    expect(within(resumo).getByRole('button', { name: 'Editar seção Resumo' })).toBeDisabled();

    const outra = secao('Decisões');
    expect(within(outra).getByRole('button', { name: 'Regerar seção Decisões' })).toBeDisabled();
    expect(
      within(outra).getByRole('button', { name: 'Ajustar seção Decisões com instrução' }),
    ).toBeDisabled();
    expect(within(outra).getByText(MOTIVO_OCUPADA)).toBeVisible();
    expect(screen.getByRole('button', { name: /Gerar ata/ })).toBeDisabled();
    expect(
      within(screen.getByRole('region', { name: 'Gerar ata' })).getByText(MOTIVO_OCUPADA),
    ).toBeVisible();

    // Edição manual de outra seção segue disponível.
    await user.click(within(outra).getByRole('button', { name: 'Editar seção Decisões' }));
    const campo = within(outra).getByRole('textbox', { name: 'Texto da seção Decisões' });
    await user.type(campo, '{Enter}{Enter}Mais um parágrafo.');
    await user.click(within(outra).getByRole('button', { name: 'Salvar' }));
    expect(within(outra).getByText('Mais um parágrafo.')).toBeVisible();

    await user.click(cancelar);
    await waitFor(() => {
      expect(within(resumo).queryByRole('progressbar')).not.toBeInTheDocument();
    });
    expect(within(resumo).getByText(/Regeração cancelada/)).toBeVisible();
    expect(within(resumo).getByText('Foi tratado o reembolso.')).toBeVisible();
    expect(lerResultado().secoes.resumo).toEqual(resultado().secoes.resumo);
    expect(within(outra).getByRole('button', { name: 'Regerar seção Decisões' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Gerar ata/ })).toBeEnabled();
  });

  it('enquanto a ata inteira é gerada, as ações de IA das seções ficam paradas com motivo', async () => {
    const espera = pendente();
    const { user } = renderizar({ impl: { gemini: espera.gerar }, comBarra: true });
    await user.click(screen.getByRole('button', { name: /Gerar ata/ }));
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));

    const s = secao('Resumo');
    expect(within(s).getByRole('button', { name: 'Regerar seção Resumo' })).toBeDisabled();
    expect(
      within(s).getByRole('button', { name: 'Ajustar seção Resumo com instrução' }),
    ).toBeDisabled();
    expect(within(s).getByText(MOTIVO_OCUPADA)).toBeVisible();
    // A ata inteira vai substituir tudo: editar agora se perderia.
    expect(within(s).getByRole('button', { name: 'Editar seção Resumo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(within(s).getByRole('button', { name: 'Regerar seção Resumo' })).toBeEnabled();
    });
  });

  it('sem chave de IA: regerar e ajustar ficam parados com o motivo; editar funciona', async () => {
    const { user } = renderizar({ chaves: [] });
    const s = secao('Resumo');
    expect(within(s).getByRole('button', { name: 'Regerar seção Resumo' })).toBeDisabled();
    expect(
      within(s).getByRole('button', { name: 'Ajustar seção Resumo com instrução' }),
    ).toBeDisabled();
    expect(within(s).getByText(MOTIVO_SEM_CHAVE)).toBeVisible();
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    expect(within(s).getByRole('textbox', { name: 'Texto da seção Resumo' })).toBeVisible();
  });
});

describe('revisão por seção: encaminhamentos', () => {
  it('editar linhas: alterar, adicionar e remover; prazo aceita data ou texto livre', async () => {
    const { user } = renderizar();
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));

    const primeiro = within(s).getByRole('group', { name: 'Encaminhamento 1' });
    const acao = within(primeiro).getByRole('textbox', { name: 'Ação' });
    await user.clear(acao);
    await user.type(acao, 'Enviar a planilha final');
    await user.selectOptions(
      within(primeiro).getByRole('combobox', { name: 'Status' }),
      'concluido',
    );
    expect(within(primeiro).getByRole('textbox', { name: 'Prazo' })).toHaveAccessibleDescription(
      /AAAA-MM-DD/,
    );

    await user.click(within(s).getByRole('button', { name: 'Remover encaminhamento 2' }));
    await user.click(within(s).getByRole('button', { name: 'Adicionar encaminhamento' }));
    const novo = within(s).getByRole('group', { name: 'Encaminhamento 2' });
    expect(within(novo).getByRole('textbox', { name: 'Ação' })).toHaveFocus();
    await user.type(
      within(novo).getByRole('textbox', { name: 'Ação' }),
      'Marcar a próxima reunião',
    );
    await user.type(within(novo).getByRole('textbox', { name: 'Responsável' }), 'Bruno Lima');
    await user.type(within(novo).getByRole('textbox', { name: 'Prazo' }), 'na próxima reunião');
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));

    expect(lerResultado().encaminhamentos).toEqual([
      {
        acao: 'Enviar a planilha final',
        responsavel: 'Ana Souza',
        prazo: '2026-10-30',
        status: 'concluido',
      },
      {
        acao: 'Marcar a próxima reunião',
        responsavel: 'Bruno Lima',
        prazo: 'na próxima reunião',
        status: 'pendente',
      },
    ]);
    expect(lerResultado().editadas).toEqual(['encaminhamentos']);
    expect(within(s).getByText('Editado por você')).toBeVisible();
    expect(within(s).getByText('30/10/2026')).toBeVisible();
    expect(within(s).getByText('Concluído')).toBeVisible();
    expect(within(s).getByText('na próxima reunião')).toBeVisible();
  });

  it('linha preenchida pela metade (sem ação) impede salvar e leva o foco ao campo', async () => {
    const { user } = renderizar();
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
    await user.click(within(s).getByRole('button', { name: 'Adicionar encaminhamento' }));
    const novo = within(s).getByRole('group', { name: 'Encaminhamento 3' });
    await user.type(within(novo).getByRole('textbox', { name: 'Responsável' }), 'Bruno Lima');
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));
    expect(within(s).getByRole('alert')).toHaveTextContent(/Informe a ação do encaminhamento 3/);
    expect(within(novo).getByRole('textbox', { name: 'Ação' })).toHaveFocus();
    expect(lerResultado()).toEqual(resultado());
  });

  it('Esc cancela o editor de linhas sem alterar nada', async () => {
    const { user } = renderizar();
    const s = secao('Encaminhamentos');
    const editar = within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' });
    await user.click(editar);
    await user.click(within(s).getByRole('button', { name: 'Remover encaminhamento 1' }));
    await user.keyboard('{Escape}');
    expect(lerResultado()).toEqual(resultado());
    expect(within(s).getByText('Enviar a planilha')).toBeVisible();
    expect(editar).toHaveFocus();
  });

  it('regerar encaminhamentos troca a lista e a atribuição, sem mexer nas seções', async () => {
    const { user, gerar } = renderizar({
      impl: {
        gemini: () =>
          Promise.resolve({
            encaminhamentos: [
              {
                acao: 'Pagar o fornecedor',
                responsavel: '',
                prazo: '2026-11-05',
                status: 'pendente',
              },
            ],
          }),
      },
    });
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Encaminhamentos' }));
    expect(await within(s).findByText('Pagar o fornecedor')).toBeVisible();
    expect(gerar.gemini.mock.calls[0]?.[1].usuario).toContain('Enviar a planilha');
    const r = lerResultado();
    expect(r.encaminhamentos).toEqual([
      {
        acao: 'Pagar o fornecedor',
        responsavel: 'A definir',
        prazo: '2026-11-05',
        status: 'pendente',
      },
    ]);
    expect(r.atribuicao.encaminhamentos?.provedor).toBe('gemini');
    expect(r.secoes).toEqual(resultado().secoes);
  });

  it(
    'com 200 encaminhamentos o editor continua utilizável (editar uma linha e salvar)',
    async () => {
      const muitos = Array.from({ length: 200 }, (_, i) => ({
        acao: `Ação número ${String(i + 1)}`,
        responsavel: `Pessoa ${String(i + 1)}`,
        prazo: '2026-11-05',
        status: 'pendente' as const,
      }));
      const { user } = renderizar({
        inicial: rascunho({ resultado: resultado({ encaminhamentos: muitos }) }),
      });
      const s = secao('Encaminhamentos');
      await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
      expect(within(s).getAllByRole('group', { name: /^Encaminhamento \d+$/ })).toHaveLength(200);
      const ultimo = within(s).getByRole('group', { name: 'Encaminhamento 200' });
      const acao = within(ultimo).getByRole('textbox', { name: 'Ação' });
      await user.clear(acao);
      await user.type(acao, 'Ação final');
      await user.click(within(s).getByRole('button', { name: 'Salvar' }));
      const r = lerResultado();
      expect(r.encaminhamentos).toHaveLength(200);
      expect(r.encaminhamentos[199]?.acao).toBe('Ação final');
      expect(r.encaminhamentos[0]).toEqual(muitos[0]);
    },
    TEMPO_VOLUME_MS,
  );
});

describe('revisão por seção: seções sem conteúdo', () => {
  it('seção que a IA deixou vazia aparece como marcador na posição do documento', () => {
    renderizar();
    const ordem = Array.from(document.querySelectorAll('[data-secao]')).map((e) =>
      e.getAttribute('data-secao'),
    );
    expect(ordem).toEqual([
      'resumo',
      'discussao',
      'decisoes',
      'pendencias',
      'riscos',
      'proxima_reuniao',
      'encaminhamentos',
    ]);
    const riscos = secao('Riscos');
    expect(within(riscos).getByText('Seção sem conteúdo')).toBeVisible();
    expect(within(riscos).getByRole('button', { name: 'Escrever seção Riscos' })).toBeEnabled();
    expect(within(riscos).getByRole('button', { name: 'Gerar esta seção (Riscos)' })).toBeEnabled();
    // Ajustar só faz sentido com texto para ajustar.
    expect(within(riscos).queryByRole('button', { name: /Ajustar/ })).not.toBeInTheDocument();
    expect(within(riscos).queryByText(/Gerado por|Editado por/)).not.toBeInTheDocument();
  });

  it('"Gerar esta seção" preenche o marcador, sem pedir confirmação', async () => {
    const { user, gerar } = renderizar({
      impl: { gemini: () => Promise.resolve(respostaBlocos('Risco de atraso no reembolso.')) },
    });
    const riscos = secao('Riscos');
    await user.click(within(riscos).getByRole('button', { name: 'Gerar esta seção (Riscos)' }));
    expect(await within(riscos).findByText('Risco de atraso no reembolso.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(riscos).queryByText('Seção sem conteúdo')).not.toBeInTheDocument();
    expect(within(riscos).getByText('Gerado por Gemini · gemini-3.8-flash')).toBeVisible();
    expect(within(riscos).getByRole('button', { name: 'Regerar seção Riscos' })).toBeEnabled();
    expect(gerar.gemini.mock.calls[0]?.[1].usuario).toContain('Texto atual da seção: vazio.');
    expect(lerResultado().secoes.riscos).toEqual([
      { tipo: 'paragrafo', texto: 'Risco de atraso no reembolso.', itens: [] },
    ]);
  });

  it('"Escrever" abre o editor vazio e o texto salvo ocupa o lugar do marcador', async () => {
    const { user } = renderizar();
    const riscos = secao('Riscos');
    await user.click(within(riscos).getByRole('button', { name: 'Escrever seção Riscos' }));
    const campo = within(riscos).getByRole('textbox', { name: 'Texto da seção Riscos' });
    expect(campo).toHaveValue('');
    await user.type(campo, 'Prazo apertado.');
    await user.click(within(riscos).getByRole('button', { name: 'Salvar' }));
    expect(within(riscos).getByText('Prazo apertado.')).toBeVisible();
    expect(within(riscos).getByText('Editado por você')).toBeVisible();
    expect(within(riscos).getByRole('button', { name: 'Editar seção Riscos' })).toHaveFocus();
  });

  it('salvar vazio sobre um marcador não muda nada', async () => {
    const { user } = renderizar();
    const riscos = secao('Riscos');
    await user.click(within(riscos).getByRole('button', { name: 'Escrever seção Riscos' }));
    await user.click(within(riscos).getByRole('button', { name: 'Salvar' }));
    expect(lerResultado()).toEqual(resultado());
  });

  it('apagar todas as linhas dos encaminhamentos os remove da ata e deixa o marcador', async () => {
    const { user } = renderizar();
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
    await user.click(within(s).getByRole('button', { name: 'Remover encaminhamento 1' }));
    await user.click(within(s).getByRole('button', { name: 'Remover encaminhamento 1' }));
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));
    expect(lerResultado().encaminhamentos).toEqual([]);
    expect(lerResultado().editadas).toEqual(['encaminhamentos']);
    expect(within(s).queryByRole('table')).not.toBeInTheDocument();
    expect(within(s).getByText('Seção sem conteúdo')).toBeVisible();
  });

  it('"Gerar esta seção" nos encaminhamentos vazios preenche a tabela', async () => {
    const { user } = renderizar({
      inicial: rascunho({ resultado: resultado({ encaminhamentos: [] }) }),
      impl: {
        gemini: () =>
          Promise.resolve({
            encaminhamentos: [
              { acao: 'Pagar o fornecedor', responsavel: 'Ana', prazo: '', status: 'pendente' },
            ],
          }),
      },
    });
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Gerar esta seção (Encaminhamentos)' }));
    expect(await within(s).findByText('Pagar o fornecedor')).toBeVisible();
    expect(within(s).getByRole('table')).toBeVisible();
  });
});

describe('revisão por seção: ajustes finos', () => {
  it('editor aberto quando a ata inteira começa a gerar: Salvar fica parado com o motivo à vista', async () => {
    const espera = pendente();
    const { user } = renderizar({ impl: { gemini: espera.gerar }, comBarra: true });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    await user.type(
      within(s).getByRole('textbox', { name: 'Texto da seção Resumo' }),
      ' Mais um trecho.',
    );
    await user.click(screen.getByRole('button', { name: /Gerar ata/ }));
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));

    const editor = within(s).getByRole('group', { name: 'Editar seção Resumo' });
    expect(within(editor).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(within(editor).getByText(MOTIVO_OCUPADA)).toBeVisible();

    await user.click(
      within(screen.getByRole('region', { name: 'Gerar ata' })).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    await waitFor(() => {
      expect(within(editor).getByRole('button', { name: 'Salvar' })).toBeEnabled();
    });
    expect(within(editor).queryByText(MOTIVO_OCUPADA)).not.toBeInTheDocument();
  });

  it('o mesmo vale para o editor de encaminhamentos', async () => {
    const espera = pendente();
    const { user } = renderizar({ impl: { gemini: espera.gerar }, comBarra: true });
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
    await user.click(screen.getByRole('button', { name: /Gerar ata/ }));
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    const editor = within(s).getByRole('group', { name: 'Editar seção Encaminhamentos' });
    expect(within(editor).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(within(editor).getByText(MOTIVO_OCUPADA)).toBeVisible();
  });

  it('encaminhamentos: salvar sem tocar (chaves em outra ordem) não marca como editado', async () => {
    const reordenado = [
      {
        status: 'em_andamento',
        prazo: '2026-10-30',
        responsavel: 'Ana Souza',
        acao: 'Enviar a planilha',
      },
    ] as unknown as ResultadoAta['encaminhamentos'];
    const { user } = renderizar({
      inicial: rascunho({ resultado: resultado({ encaminhamentos: reordenado }) }),
    });
    const s = secao('Encaminhamentos');
    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));
    expect(lerResultado().editadas).toEqual([]);
    expect(within(s).getByText('Gerado por OpenAI · gpt-6-luna')).toBeVisible();
  });

  it('encaminhamentos: espaços nas pontas não contam como mudança; mudança real conta', async () => {
    const { user } = renderizar();
    const s = secao('Encaminhamentos');
    const acao = () =>
      within(within(s).getByRole('group', { name: 'Encaminhamento 1' })).getByRole('textbox', {
        name: 'Ação',
      });
    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
    await user.type(acao(), '  ');
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));
    expect(lerResultado().editadas).toEqual([]);

    await user.click(within(s).getByRole('button', { name: 'Editar seção Encaminhamentos' }));
    await user.type(acao(), ' final');
    await user.click(within(s).getByRole('button', { name: 'Salvar' }));
    expect(lerResultado().editadas).toEqual(['encaminhamentos']);
  });

  it('abrir Editar encerra o aviso de "Regeração cancelada" da seção', async () => {
    const espera = pendente();
    const { user } = renderizar({ impl: { gemini: espera.gerar } });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    await user.click(within(s).getByRole('button', { name: 'Cancelar regeração da seção Resumo' }));
    expect(await within(s).findByText(/Regeração cancelada/)).toBeVisible();
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    expect(within(s).queryByText(/Regeração cancelada/)).not.toBeInTheDocument();
  });

  it('abrir Editar encerra o aviso de erro da seção', async () => {
    const { user } = renderizar({
      impl: {
        gemini: () =>
          Promise.reject(erroProvedor('muito_longo', 'gemini', { modelo: 'gemini-3.8-flash' })),
      },
    });
    const s = secao('Resumo');
    await user.click(within(s).getByRole('button', { name: 'Regerar seção Resumo' }));
    expect(await within(s).findByRole('alert')).toBeVisible();
    await user.click(within(s).getByRole('button', { name: 'Editar seção Resumo' }));
    expect(within(s).queryByRole('alert')).not.toBeInTheDocument();
  });
});
