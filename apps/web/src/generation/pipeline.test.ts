import { createMaskMap, mask } from '@lavra/pii-br';
import { describe, expect, it, vi } from 'vitest';
import { cipa } from '../ata-types/cipa';
import { condominio } from '../ata-types/condominio';
import { corporativa } from '../ata-types/corporativa';
import { sociosLtda } from '../ata-types/socios-ltda';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
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

describe('gerarAta: extras de participante', () => {
  const UNIDADE = 'Apto 101';
  const FRACAO = '0,0125';
  const respostaDoTeste = () => ({
    secoes: Object.fromEntries(TIPO_DE_TESTE.secoes.map((s) => [s.chave, []])),
    encaminhamentos: [],
  });
  const dTeste = (parcial: Partial<Participante> = {}): AtaDraft => ({
    ...rascunho(),
    tipoId: TIPO_DE_TESTE.id,
    dados: { data: '2026-10-14', natureza: 'ordinaria', modalidade: 'hibrida' },
    participantes: [
      {
        ...ANA,
        papel: '',
        extras: { unidade: UNIDADE, vinculo: 'proprietario', fracao: FRACAO },
        ...parcial,
      },
    ],
    transcricao: 'Ana: concordo.',
  });

  it('extras que não vão para a IA não saem do navegador', async () => {
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve(respostaDoTeste()),
    });
    await gerarAta(dTeste(), TIPO_DE_TESTE, CADEIA, sinal(), opcoes);
    const enviado = `${pedidos[0]?.sistema ?? ''}\n${pedidos[0]?.usuario ?? ''}`;
    expect(enviado).toContain('Ana Souza — Proprietário(a) — presente');
    expect(enviado).not.toContain(UNIDADE);
    expect(enviado).not.toContain(FRACAO);
  });

  it('CPF digitado no nome chega mascarado', async () => {
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve(respostaDoTeste()),
    });
    await gerarAta(dTeste({ nome: `Ana ${CPF}` }), TIPO_DE_TESTE, CADEIA, sinal(), opcoes);
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).toContain('Ana [CPF_1]');
    expect(usuario).not.toContain(CPF);
  });

  it('CPF digitado em um extra que não segue não aparece, nem como CPF nem como marcador', async () => {
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve(respostaDoTeste()),
    });
    await gerarAta(
      dTeste({ extras: { unidade: CPF, vinculo: 'proprietario' } }),
      TIPO_DE_TESTE,
      CADEIA,
      sinal(),
      opcoes,
    );
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).not.toContain(CPF);
    expect(usuario).not.toContain('52998224725');
    // O texto fixo do prompt cita "[CPF_1]" como exemplo: confere só dos dados em diante.
    expect(usuario.slice(0, usuario.indexOf('Transcrição'))).not.toMatch(/\[CPF_\d+\]/);
    expect(usuario).toContain('<transcricao>\nAna: concordo.\n</transcricao>');
  });

  it('a visibilidade do extra enviado é decidida sobre a cópia mascarada dos dados (uma decisão só)', async () => {
    const lidos: Record<string, string>[] = [];
    const tipo = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'vinculo'
          ? {
              ...c,
              visivelSe: (dados: Record<string, string>) => {
                lidos.push({ ...dados });
                return true;
              },
            }
          : c,
      ),
    };
    const { opcoes } = adaptadores({ openai: () => Promise.resolve(respostaDoTeste()) });
    const d = { ...dTeste(), dados: { ...dTeste().dados, modalidade: `híbrida ${CPF}` } };
    await gerarAta(d, tipo, CADEIA, sinal(), opcoes);
    expect(lidos.length).toBeGreaterThan(0);
    expect(JSON.stringify(lidos)).not.toContain(CPF);
    expect(lidos.every((dados) => dados.modalidade?.includes('[CPF_') === true)).toBe(true);
  });

  it('extra marcado para a IA segue, mas mascarado', async () => {
    const tipo = {
      ...TIPO_DE_TESTE,
      camposParticipante: [
        ...TIPO_DE_TESTE.camposParticipante,
        {
          id: 'procuracao',
          rotulo: 'Procuração',
          tipo: 'texto' as const,
          obrigatorio: false,
          enviarParaIA: true,
        },
      ],
    };
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve(respostaDoTeste()),
    });
    await gerarAta(
      dTeste({ extras: { vinculo: 'procurador', procuracao: `outorgada por ${CPF}` } }),
      tipo,
      CADEIA,
      sinal(),
      opcoes,
    );
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).toContain('Ana Souza — Procurador(a) — outorgada por [CPF_1] — presente');
    expect(usuario).not.toContain(CPF);
  });
});

describe('regerarSecao: CIPA (primeiro tipo registrado com extras enviados à IA)', () => {
  const base = (): AtaDraft => ({
    ...rascunho(),
    tipoId: cipa.id,
    dados: {
      data: '2026-10-14',
      natureza: 'ordinaria',
      modalidade: 'hibrida',
      presidente: 'Ana Souza',
      secretario: 'Bruno Lima',
      gestao: '2026/2027',
      local: 'Sala 2',
      plataforma: 'Sala virtual',
    },
    participantes: [
      { ...ANA, extras: { representacao: 'organizacao', condicao: 'titular' } },
      {
        ...ANA,
        id: 'p2',
        nome: `Bruno Lima ${CPF_2}`,
        papel: 'Técnico',
        presenca: 'justificado',
        justificativa: `Atestado ${TELEFONE}`,
        // Valor fora das opções (rascunho corrompido) com um CPF: não sai, nem como marcador.
        extras: { representacao: CPF, condicao: 'suplente' },
      },
    ],
    transcricao: `Ana: o CPF ${CPF} foi corrigido no cadastro.`,
  });

  it('envia representação e condição (rótulos), mascara o resto e não vaza valor fora das opções', async () => {
    const d0 = base();
    const mapa = mask(d0.transcricao, { map: createMaskMap() }).map;
    const d = comResultado(
      d0,
      { secoes: { deliberacoes: [par(`Aprovada por consenso a correção do CPF ${CPF}.`)] } },
      mapa,
    );
    const { opcoes, pedidos } = adaptadores({
      openai: () =>
        Promise.resolve({ blocos: [par('Aprovada por consenso a correção de [CPF_1].')] }),
    });
    const r = await regerarSecao(d, cipa, 'deliberacoes', null, CADEIA, sinal(), opcoes);
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).toContain(
      'Ana Souza — Diretora — Representante da organização — Titular — presente',
    );
    expect(usuario).toMatch(/Bruno Lima \[CPF_\d\] — Técnico — Suplente — ausência justificada/);
    expect(usuario).toContain('Aprovada por consenso a correção do CPF [CPF_1].');
    for (const vazado of [
      CPF,
      CPF_2,
      TELEFONE,
      '2026/2027',
      'Sala 2',
      'Sala virtual',
      'Atestado',
    ]) {
      expect(usuario).not.toContain(vazado);
    }
    expect(r.blocos).toEqual([par(`Aprovada por consenso a correção de ${CPF}.`)]);
    expect(r.avisos).toEqual([]);
  });
});

describe('regerarSecao: condomínio (extras que ficam no navegador num tipo registrado)', () => {
  const UNIDADE = 'Apto 101';
  const FRACAO = '0,0125';

  it('envia o vínculo; unidade, fração, CNPJ, endereço e local nunca saem, nem como marcador', async () => {
    const d0: AtaDraft = {
      ...rascunho(),
      tipoId: condominio.id,
      dados: {
        condominio: 'Condomínio Edifício Exemplo',
        cnpj: '11.222.333/0001-81',
        endereco: 'Rua das Flores, 100',
        natureza: 'ordinaria',
        chamada: 'segunda',
        data: '2026-10-14',
        modalidade: 'presencial',
        local: 'Salão de festas',
        presidente: 'Ana Souza',
        secretario: 'Bruno Lima',
      },
      participantes: [
        {
          ...ANA,
          papel: '',
          extras: { unidade: UNIDADE, vinculo: 'proprietario', fracao: FRACAO },
        },
        // CPF digitado na unidade (extra que não segue): não sai, nem como CPF nem como marcador.
        {
          ...ANA,
          id: 'p2',
          nome: 'Bruno Lima',
          papel: '',
          extras: { unidade: CPF_2, vinculo: 'locatario' },
        },
      ],
      transcricao: `Ana: o CPF ${CPF} foi corrigido no cadastro.`,
    };
    const mapa = mask(d0.transcricao, { map: createMaskMap() }).map;
    const d = comResultado(
      d0,
      {
        secoes: {
          ordem_do_dia: [par(`Item 1: correção do CPF ${CPF}. [PREENCHER: resultado da votação]`)],
        },
      },
      mapa,
    );
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve({ blocos: [par('Item 1: correção de [CPF_1].')] }),
    });
    const r = await regerarSecao(d, condominio, 'ordem_do_dia', null, CADEIA, sinal(), opcoes);
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).toContain('Ana Souza — Proprietário(a) — presente');
    expect(usuario).toContain('Bruno Lima — Locatário(a) — presente');
    expect(usuario).toContain('[PREENCHER: resultado da votação]');
    for (const vazado of [
      CPF,
      CPF_2,
      UNIDADE,
      FRACAO,
      'Edifício Exemplo',
      '11.222.333',
      'Rua das Flores',
      'Salão de festas',
    ]) {
      expect(usuario).not.toContain(vazado);
    }
    // Dados da reunião e participantes (antes do texto atual, que traz o CPF da transcrição).
    const dadosEnviados = usuario.slice(0, usuario.indexOf('\nSeção: '));
    expect(dadosEnviados).toContain('Participantes (nome — vínculo — presença)');
    expect(dadosEnviados).not.toMatch(/\[CPF_\d+\]/);
    expect(r.blocos).toEqual([par(`Item 1: correção de ${CPF}.`)]);
  });
});

describe('regerarSecao: sócios de Ltda (extra de texto livre enviado à IA)', () => {
  it('envia o procurador mascarado; participação, total de quotas e dados da sociedade nunca saem', async () => {
    const d0: AtaDraft = {
      ...rascunho(),
      tipoId: sociosLtda.id,
      dados: {
        razao_social: 'Empresa Exemplo Ltda.',
        cnpj: '11.222.333/0001-81',
        nire: '35212345678',
        sede: 'Rua das Flores, 100',
        forma: 'reuniao',
        data: '2026-10-14',
        modalidade: 'presencial',
        local: 'Sala de reuniões',
        convocacao: 'contrato',
        convocacao_detalhe: 'e-mail de 01/10/2026',
        presidente: 'Ana Souza',
        secretario: 'Bruno Lima',
        modo_capital: 'quotas',
        total_quotas: '8.000',
      },
      participantes: [
        { ...ANA, papel: '', extras: { participacao: '4.375' } },
        // Procurador digitado com o CPF: segue mascarado, como o resto do texto livre.
        {
          ...ANA,
          id: 'p2',
          nome: 'Bruno Lima',
          papel: '',
          extras: { participacao: '3.625', procurador: `Carla Dias, CPF ${CPF_2}` },
        },
      ],
      transcricao: `Ana: o CPF ${CPF} foi corrigido no contrato.`,
    };
    const mapa = mask(d0.transcricao, { map: createMaskMap() }).map;
    const d = comResultado(
      d0,
      {
        secoes: {
          deliberacoes: [
            par(`Item 1: correção do CPF ${CPF}. [PREENCHER: votos e quórum de aprovação]`),
          ],
        },
      },
      mapa,
    );
    const { opcoes, pedidos } = adaptadores({
      openai: () => Promise.resolve({ blocos: [par('Item 1: correção de [CPF_1].')] }),
    });
    const r = await regerarSecao(d, sociosLtda, 'deliberacoes', null, CADEIA, sinal(), opcoes);
    const usuario = pedidos[0]?.usuario ?? '';
    expect(usuario).toContain('Participantes (nome — representado(a) por — presença)');
    expect(usuario).toContain('Ana Souza — presente');
    expect(usuario).toMatch(/Bruno Lima — Carla Dias, CPF \[CPF_\d+\] — presente/);
    expect(usuario).toContain('[PREENCHER: votos e quórum de aprovação]');
    for (const vazado of [
      CPF,
      CPF_2,
      '4.375',
      '3.625',
      '8.000',
      'Empresa Exemplo',
      '11.222.333',
      '35212345678',
      'Rua das Flores',
      'Sala de reuniões',
      'e-mail de 01/10/2026',
    ]) {
      expect(usuario).not.toContain(vazado);
    }
    expect(r.blocos).toEqual([par(`Item 1: correção de ${CPF}.`)]);
  });
});
