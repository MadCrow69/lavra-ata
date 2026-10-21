import { createMaskMap, mask } from '@lavra/pii-br';
import { describe, expect, it, vi } from 'vitest';
import { corporativa } from '../ata-types/corporativa';
import { ErroCadeia, ErroProvedor, erroProvedor } from '../ai/errors';
import type { GenerateRequest, ProviderAdapter, ProviderConfig, ProviderId } from '../ai/types';
import type { AtaDraft, Bloco, Encaminhamento, Participante, ResultadoAta } from '../domain/draft';
import { CHAVE_AVISOS_GERAIS, criarRascunho } from '../domain/draft-reducer';
import { normalizarResultado } from './normalize';
import { gerarAta, regerarSecao } from './pipeline';

const CPF = '529.982.247-25';
const CPF_2 = '111.444.777-35';
const TELEFONE = '(11) 98888-7777';

const CADEIA: ProviderConfig[] = [
  { id: 'openai', modelo: 'gpt-6-luna', chave: 'sk-teste-ficticia-1' },
  { id: 'gemini', modelo: 'gemini-3.8-flash', chave: 'AIzaTesteFicticia2' },
];

type Gerar = (cfg: ProviderConfig, req: GenerateRequest) => Promise<unknown>;

function adaptadores(impl: Partial<Record<ProviderId, Gerar>>) {
  const pedidos: GenerateRequest[] = [];
  const mk = (id: ProviderId): ProviderAdapter => ({
    id,
    rotulo: id,
    gerar: (cfg, req) => {
      pedidos.push(req);
      const f = impl[id];
      return f ? f(cfg, req) : Promise.reject(new Error('não deveria ser chamado'));
    },
    testarChave: () => Promise.resolve(),
  });
  return {
    opcoes: {
      adaptadores: { openai: mk('openai'), gemini: mk('gemini'), anthropic: mk('anthropic') },
      esperaRetryMs: 0,
    },
    pedidos,
  };
}

function respostaAta(
  secoes: Partial<Record<string, Bloco[]>> = {},
  encaminhamentos: Encaminhamento[] = [],
) {
  return {
    secoes: Object.fromEntries(corporativa.secoes.map((s) => [s.chave, secoes[s.chave] ?? []])),
    encaminhamentos,
  };
}

const par = (texto: string): Bloco => ({ tipo: 'paragrafo', texto, itens: [] });

const ANA: Participante = {
  id: 'p1',
  nome: 'Ana Souza',
  papel: 'Diretora',
  presenca: 'presente',
  justificativa: '',
  extras: {},
};

function rascunho(parcial: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(),
    dados: { data: '2026-10-14', modalidade: 'remota', organizacao: 'Cooperativa Fictícia' },
    pauta: ['Reembolsos'],
    participantes: [ANA],
    transcricao: `Ana: o reembolso vai para o CPF ${CPF}. Bruno confirma.`,
    ...parcial,
  };
}

const sinal = () => new AbortController().signal;

describe('gerarAta', () => {
  it('envia só texto mascarado e devolve o CPF restaurado campo a campo', async () => {
    const { opcoes, pedidos } = adaptadores({
      openai: () =>
        Promise.resolve(
          respostaAta({ resumo: [par('  Reembolso ao CPF [CPF_1] aprovado.  ')] }, [
            { acao: 'Pagar [CPF_1]', responsavel: '  ', prazo: ' 2026-10-30 ', status: 'pendente' },
          ]),
        ),
    });
    const d = rascunho();
    const { resultado, mapa, colisoes } = await gerarAta(d, corporativa, CADEIA, sinal(), opcoes);

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.usuario).toContain('[CPF_1]');
    expect(pedidos[0]?.usuario).not.toContain(CPF);
    expect(pedidos[0]?.sistema).not.toContain(CPF);
    expect(JSON.stringify(pedidos[0]?.schema)).not.toContain(CPF);

    expect(resultado.secoes.resumo).toEqual([par(`Reembolso ao CPF ${CPF} aprovado.`)]);
    expect(resultado.encaminhamentos).toEqual([
      { acao: `Pagar ${CPF}`, responsavel: 'A definir', prazo: '2026-10-30', status: 'pendente' },
    ]);
    expect(resultado.secoes.riscos).toEqual([]);
    expect(resultado.editadas).toEqual([]);
    expect(resultado.atribuicao.resumo).toEqual({
      provedor: 'openai',
      modelo: 'gpt-6-luna',
      falhas: [],
    });
    expect(resultado.atribuicao.encaminhamentos?.provedor).toBe('openai');
    expect(Object.values(resultado.avisos).flat()).toEqual([]);
    expect(mapa.markers['[CPF_1]']).toBe(CPF);
    expect(colisoes).toEqual([]);
  });

  it('resposta com [CPF_9] gera aviso na seção certa', async () => {
    const { opcoes } = adaptadores({
      openai: () =>
        Promise.resolve(
          respostaAta({
            resumo: [par('Reembolso ao [CPF_1].')],
            decisoes: [{ tipo: 'lista', texto: '', itens: ['Pagar o titular [CPF_9].'] }],
          }),
        ),
    });
    const { resultado } = await gerarAta(rascunho(), corporativa, CADEIA, sinal(), opcoes);
    expect(resultado.avisos.resumo).toEqual([]);
    expect(resultado.avisos.decisoes).toHaveLength(1);
    expect(resultado.avisos.decisoes?.[0]).toContain('[CPF_9]');
    // Marcador desconhecido fica como está (o unmask não inventa valor).
    expect(resultado.secoes.decisoes?.[0]?.itens).toEqual(['Pagar o titular [CPF_9].']);
  });

  it('telefone inventado pela IA vira aviso na seção onde apareceu', async () => {
    const { opcoes } = adaptadores({
      openai: () =>
        Promise.resolve(
          respostaAta({ pendencias: [par(`Ligar para Bruno no ${TELEFONE}.`)] }, [
            { acao: 'Ligar', responsavel: 'Ana', prazo: '', status: 'pendente' },
          ]),
        ),
    });
    const { resultado } = await gerarAta(rascunho(), corporativa, CADEIA, sinal(), opcoes);
    expect(resultado.avisos.pendencias).toEqual([
      'A IA citou um telefone que não estava na transcrição — confira.',
    ]);
    expect(resultado.avisos.resumo).toEqual([]);
    expect(resultado.avisos.encaminhamentos).toEqual([]);
  });

  it('marcador quebrado e identificador inventado nos encaminhamentos avisam lá', async () => {
    const { opcoes } = adaptadores({
      openai: () =>
        Promise.resolve(
          respostaAta({}, [
            { acao: 'Pagar CPF_1', responsavel: 'Ana', prazo: '', status: 'pendente' },
            { acao: `Conferir ${CPF_2}`, responsavel: 'Ana', prazo: '', status: 'pendente' },
          ]),
        ),
    });
    const { resultado } = await gerarAta(rascunho(), corporativa, CADEIA, sinal(), opcoes);
    const avisos = resultado.avisos.encaminhamentos ?? [];
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toContain('CPF_1');
    expect(avisos[1]).toBe('A IA citou um CPF que não estava na transcrição — confira.');
  });

  it('colisão com marcador já usado gera aviso global', async () => {
    const anterior = mask(`CPF ${CPF_2}`, { map: createMaskMap() }).map;
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve(respostaAta({ resumo: [par('Ok.')] })),
    });
    const d = rascunho({
      mapa: anterior,
      transcricao: 'Ana: no sistema antigo o campo aparecia como [CPF_1], sem número.',
    });
    const { resultado, colisoes } = await gerarAta(d, corporativa, CADEIA, sinal(), opcoes);
    expect(colisoes).toEqual(['[CPF_1]']);
    expect(resultado.avisos[CHAVE_AVISOS_GERAIS]).toEqual([
      'Seu texto já tinha um trecho parecido com um marcador ([CPF_1]); ele foi mantido como [CPF#1].',
    ]);
    expect(pedidos[0]?.usuario).toContain('[CPF#1]');
  });

  it('identificador digitado na pauta ou no papel também sai mascarado', async () => {
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve(respostaAta()),
    });
    const d = rascunho({
      pauta: [`Cadastro do CPF ${CPF_2}`],
      participantes: [{ ...ANA, papel: `Contato ${TELEFONE}` }],
    });
    const { mapa } = await gerarAta(d, corporativa, CADEIA, sinal(), opcoes);
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).not.toContain(CPF_2);
    expect(usuario).not.toContain('98888-7777');
    expect(usuario).toContain('[CPF_2]');
    expect(usuario).toContain('[TELEFONE_1]');
    expect(mapa.markers['[CPF_1]']).toBe(CPF);
  });

  it('com fallback, a atribuição aponta o provedor que respondeu e quem falhou', async () => {
    const { opcoes } = adaptadores({
      openai: () => Promise.reject(erroProvedor('json_invalido', 'openai')),
      gemini: () => Promise.resolve(respostaAta({ resumo: [par('Ok.')] })),
    });
    const r = await gerarAta(rascunho(), corporativa, CADEIA, sinal(), opcoes);
    expect(r.resultado.atribuicao.resumo).toEqual({
      provedor: 'gemini',
      modelo: 'gemini-3.8-flash',
      falhas: [{ provedor: 'openai', erro: 'json_invalido' }],
    });
    expect(r.falhas.map((f) => [f.provedor, f.erro])).toEqual([['openai', 'json_invalido']]);
  });

  it('todos falhando propaga ErroCadeia com as falhas em ordem', async () => {
    const { opcoes } = adaptadores({
      openai: () => Promise.reject(erroProvedor('muito_longo', 'openai', { modelo: 'gpt-6-luna' })),
      gemini: () => Promise.reject(erroProvedor('inesperado', 'gemini', { status: 418 })),
    });
    const erro: unknown = await gerarAta(rascunho(), corporativa, CADEIA, sinal(), opcoes).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ErroCadeia);
    expect((erro as ErroCadeia).falhas.map((f) => f.erro)).toEqual(['muito_longo', 'inesperado']);
    expect((erro as ErroCadeia).message).not.toContain(CPF);
  });

  it('cancelamento propaga "cancelado" sem alterar o rascunho', async () => {
    const controle = new AbortController();
    const { opcoes } = adaptadores({
      openai: (_cfg, req) =>
        new Promise((_resolve, reject) => {
          req.signal.addEventListener('abort', () => {
            reject(erroProvedor('cancelado', 'openai'));
          });
        }),
    });
    const d = rascunho();
    const antes = structuredClone(d);
    const promessa = gerarAta(d, corporativa, CADEIA, controle.signal, opcoes);
    controle.abort();
    const erro: unknown = await promessa.catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect((erro as ErroProvedor).tipo).toBe('cancelado');
    expect(d).toEqual(antes);
  });

  it('resposta que chega depois do cancelamento é descartada', async () => {
    const controle = new AbortController();
    const { opcoes } = adaptadores({
      openai: () => {
        controle.abort();
        return Promise.resolve(respostaAta({ resumo: [par('Ok.')] }));
      },
    });
    const erro: unknown = await gerarAta(
      rascunho(),
      corporativa,
      CADEIA,
      controle.signal,
      opcoes,
    ).catch((e: unknown) => e);
    expect((erro as ErroProvedor).tipo).toBe('cancelado');
  });
});

function comResultado(d: AtaDraft, resultado: Partial<ResultadoAta>, mapa = d.mapa): AtaDraft {
  return {
    ...d,
    mapa,
    resultado: {
      secoes: {},
      encaminhamentos: [],
      atribuicao: {},
      avisos: {},
      editadas: [],
      ...resultado,
    },
  };
}

describe('regerarSecao', () => {
  it('mascara o texto atual (já desmascarado) e a instrução com o mesmo mapa', async () => {
    const base = rascunho();
    const mapa = mask(base.transcricao, { map: createMaskMap() }).map;
    const d = comResultado(
      base,
      { secoes: { decisoes: [par(`Aprovado o reembolso ao CPF ${CPF}.`)] } },
      mapa,
    );
    const { opcoes, pedidos } = adaptadores({
      openai: () =>
        Promise.resolve({
          blocos: [par('Aprovado o reembolso a [CPF_1], conferido por [CPF_2].')],
        }),
    });
    const r = await regerarSecao(
      d,
      corporativa,
      'decisoes',
      `Inclua o CPF ${CPF_2} do conferente`,
      CADEIA,
      sinal(),
      opcoes,
    );
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).not.toContain(CPF);
    expect(usuario).not.toContain(CPF_2);
    expect(usuario).toContain(`Aprovado o reembolso ao CPF [CPF_1].`);
    expect(usuario).toContain('Inclua o CPF [CPF_2] do conferente');
    expect(usuario).not.toContain('#');
    expect(r.blocos).toEqual([par(`Aprovado o reembolso a ${CPF}, conferido por ${CPF_2}.`)]);
    expect(r.avisos).toEqual([]);
    expect(r.mapa.markers['[CPF_1]']).toBe(CPF);
    expect(r.mapa.markers['[CPF_2]']).toBe(CPF_2);
    expect(r.atribuicao).toEqual({ provedor: 'openai', modelo: 'gpt-6-luna', falhas: [] });
  });

  it('marcador inventado que já estava no texto atual continua avisado ao regerar', async () => {
    const base = rascunho();
    const mapa = mask(base.transcricao, { map: createMaskMap() }).map;
    const d = comResultado(
      base,
      { secoes: { decisoes: [par('Pagar o titular [CPF_9].')] }, avisos: { decisoes: ['x'] } },
      mapa,
    );
    const { opcoes } = adaptadores({
      openai: () => Promise.resolve({ blocos: [par('Pagar o titular [CPF_9] e [CPF_1].')] }),
    });
    const r = await regerarSecao(d, corporativa, 'decisoes', null, CADEIA, sinal(), opcoes);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain('[CPF_9]');
    expect(r.blocos).toEqual([par(`Pagar o titular [CPF_9] e ${CPF}.`)]);
  });

  it('literal da pessoa ecoado pela IA na geração completa não vira aviso', async () => {
    const { opcoes } = adaptadores({
      openai: () =>
        Promise.resolve(respostaAta({ resumo: [par('O campo [CPF_7] estava vazio.')] })),
    });
    const d = rascunho({ transcricao: 'Ana: o campo [CPF_7] estava vazio.' });
    const { resultado } = await gerarAta(d, corporativa, CADEIA, sinal(), opcoes);
    expect(resultado.avisos.resumo).toEqual([]);
  });

  it('aviso de identificador inventado fica na seção regerada', async () => {
    const { opcoes } = adaptadores({
      openai: () => Promise.resolve({ blocos: [par(`Contato: ${TELEFONE}.`)] }),
    });
    const r = await regerarSecao(rascunho(), corporativa, 'riscos', null, CADEIA, sinal(), opcoes);
    expect(r.avisos).toEqual(['A IA citou um telefone que não estava na transcrição — confira.']);
  });

  it('encaminhamentos regerados voltam normalizados e desmascarados', async () => {
    const base = rascunho();
    const mapa = mask(base.transcricao, { map: createMaskMap() }).map;
    const d = comResultado(
      base,
      {
        encaminhamentos: [
          { acao: `Pagar ${CPF}`, responsavel: 'Ana', prazo: '', status: 'pendente' },
        ],
      },
      mapa,
    );
    const { opcoes, pedidos } = adaptadores({
      openai: () =>
        Promise.resolve({
          encaminhamentos: [
            {
              acao: 'Pagar [CPF_1]',
              responsavel: '',
              prazo: 'próxima reunião',
              status: 'pendente',
            },
            { acao: '  ', responsavel: 'Ana', prazo: '', status: 'pendente' },
          ],
        }),
    });
    const r = await regerarSecao(d, corporativa, 'encaminhamentos', null, CADEIA, sinal(), opcoes);
    expect(pedidos[0]?.usuario).toContain('Pagar [CPF_1]');
    expect(r.blocos).toEqual([
      {
        acao: `Pagar ${CPF}`,
        responsavel: 'A definir',
        prazo: 'próxima reunião',
        status: 'pendente',
      },
    ]);
  });

  it('cancelamento propaga "cancelado" sem alterar o rascunho', async () => {
    const controle = new AbortController();
    controle.abort();
    const { opcoes } = adaptadores({ openai: vi.fn() });
    const d = rascunho();
    const antes = structuredClone(d);
    const erro: unknown = await regerarSecao(
      d,
      corporativa,
      'resumo',
      'mais curto',
      CADEIA,
      controle.signal,
      opcoes,
    ).catch((e: unknown) => e);
    expect((erro as ErroProvedor).tipo).toBe('cancelado');
    expect(d).toEqual(antes);
  });
});

describe('normalizarResultado', () => {
  it('trim, responsável vazio, status inválido, encaminhamento sem ação e seção ausente', () => {
    const r = normalizarResultado(
      {
        secoes: {
          resumo: [
            { tipo: 'paragrafo', texto: '  Texto.  ', itens: ['sobra'] },
            { tipo: 'paragrafo', texto: '   ', itens: [] },
            { tipo: 'lista', texto: '', itens: [' a ', '', '  '] },
            { tipo: 'lista', texto: 'Só introdução', itens: [] },
            { tipo: 'outro', texto: 'x', itens: [] },
            'lixo',
          ],
          extra: [par('não pedida')],
        },
        encaminhamentos: [
          { acao: ' Enviar ', responsavel: '', prazo: ' amanhã ', status: 'feito' },
          { acao: '', responsavel: 'Ana', prazo: '', status: 'pendente' },
          { acao: 'Revisar', responsavel: ' Bia ', prazo: '', status: 'concluido' },
          null,
        ],
      },
      corporativa,
    );
    expect(r.secoes.resumo).toEqual([
      par('Texto.'),
      { tipo: 'lista', texto: '', itens: ['a'] },
      par('Só introdução'),
    ]);
    expect(r.secoes.discussao).toEqual([]);
    expect(r.secoes).not.toHaveProperty('extra');
    expect(r.encaminhamentos).toEqual([
      { acao: 'Enviar', responsavel: 'A definir', prazo: 'amanhã', status: 'pendente' },
      { acao: 'Revisar', responsavel: 'Bia', prazo: '', status: 'concluido' },
    ]);
  });

  it('entrada que não é objeto vira ata vazia', () => {
    const r = normalizarResultado(null, corporativa);
    expect(Object.values(r.secoes).every((b) => b.length === 0)).toBe(true);
    expect(r.encaminhamentos).toEqual([]);
  });

  it('tipo sem encaminhamentos descarta a lista', () => {
    const r = normalizarResultado(
      { secoes: {}, encaminhamentos: [{ acao: 'x', responsavel: '', prazo: '', status: '' }] },
      { ...corporativa, temEncaminhamentos: false },
    );
    expect(r.encaminhamentos).toEqual([]);
  });
});
