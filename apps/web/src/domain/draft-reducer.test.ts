import type { MaskMap } from '@lavra/pii-br';
import { describe, expect, it } from 'vitest';
import { LIMITE_PARTICIPANTES } from '../config/limits';
import type { AtaDraft, Atribuicao, DraftAction, ResultadoAta } from './draft';
import { criarRascunho, draftReducer } from './draft-reducer';

const MAPA: MaskMap = {
  version: 1,
  markers: { '[CPF_1]': '529.982.247-25' },
  keys: {},
  counters: {},
};
const ATRIB: Atribuicao = { provedor: 'openai', modelo: 'm', fallbackDe: [] };

function resultado(): ResultadoAta {
  return {
    secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Texto', itens: [] }] },
    encaminhamentos: [{ acao: 'A', responsavel: 'B', prazo: '2026-11-01', status: 'pendente' }],
    atribuicao: { resumo: ATRIB },
    avisos: {},
    editadas: [],
  };
}

function comResultado(): AtaDraft {
  return draftReducer(criarRascunho('x'), {
    type: 'registrarResultado',
    resultado: resultado(),
    mapa: MAPA,
  });
}

describe('criarRascunho', () => {
  it('nasce vazio, versão 1, tom formal', () => {
    const d = criarRascunho();
    expect(d).toMatchObject({
      versao: 1,
      tom: 'formal',
      dados: {},
      pauta: [],
      participantes: [],
      transcricao: '',
      mapa: null,
      resultado: null,
    });
    expect(d.tipoId).toBeTruthy();
  });

  it('aceita o tipo', () => {
    expect(criarRascunho('assembleia').tipoId).toBe('assembleia');
  });
});

describe('draftReducer', () => {
  it('definirTipo e definirTom', () => {
    let d = draftReducer(criarRascunho(), { type: 'definirTipo', tipoId: 'condominio' });
    d = draftReducer(d, { type: 'definirTom', tom: 'conciso' });
    expect(d.tipoId).toBe('condominio');
    expect(d.tom).toBe('conciso');
  });

  it('definirCampo grava sem mutar o estado anterior', () => {
    const antes = criarRascunho();
    const depois = draftReducer(antes, {
      type: 'definirCampo',
      campo: 'data',
      valor: '2026-10-14',
    });
    expect(depois.dados).toEqual({ data: '2026-10-14' });
    expect(antes.dados).toEqual({});
  });

  it('definirPauta e definirTranscricao', () => {
    let d = draftReducer(criarRascunho(), { type: 'definirPauta', itens: ['A', 'B'] });
    d = draftReducer(d, { type: 'definirTranscricao', texto: 'fala' });
    expect(d.pauta).toEqual(['A', 'B']);
    expect(d.transcricao).toBe('fala');
  });

  describe('participantes', () => {
    it('adiciona com id único e valores padrão, ignorando linhas vazias', () => {
      const d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana Souza', '', '   ', ' Bruno Lima '],
      });
      expect(d.participantes.map((p) => p.nome)).toEqual(['Ana Souza', 'Bruno Lima']);
      expect(new Set(d.participantes.map((p) => p.id)).size).toBe(2);
      expect(d.participantes[0]).toMatchObject({
        papel: '',
        presenca: 'presente',
        justificativa: '',
        extras: {},
      });
    });

    it('permite nomes repetidos (id é a chave, nunca o nome)', () => {
      const d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana Souza', 'Ana Souza'],
      });
      expect(d.participantes).toHaveLength(2);
      expect(d.participantes[0]?.id).not.toBe(d.participantes[1]?.id);
    });

    it('respeita LIMITE_PARTICIPANTES', () => {
      const nomes = Array.from(
        { length: LIMITE_PARTICIPANTES + 50 },
        (_, i) => `Pessoa ${String(i)}`,
      );
      let d = draftReducer(criarRascunho(), { type: 'adicionarParticipantes', nomes });
      expect(d.participantes).toHaveLength(LIMITE_PARTICIPANTES);
      d = draftReducer(d, { type: 'adicionarParticipantes', nomes: ['Mais um'] });
      expect(d.participantes).toHaveLength(LIMITE_PARTICIPANTES);
    });

    it('atualiza por id, sem mexer nos outros nem trocar o id', () => {
      let d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana Souza', 'Ana Souza'],
      });
      const [a, b] = d.participantes;
      const idB = b?.id ?? '';
      d = draftReducer(d, {
        type: 'atualizarParticipante',
        id: idB,
        patch: { presenca: 'justificado', justificativa: 'Viagem', id: 'outro' },
      });
      expect(d.participantes[0]).toEqual(a);
      expect(d.participantes[1]).toMatchObject({
        id: idB,
        presenca: 'justificado',
        justificativa: 'Viagem',
      });
    });

    it('atualizar id inexistente não altera nada', () => {
      const antes = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana'],
      });
      const depois = draftReducer(antes, {
        type: 'atualizarParticipante',
        id: 'nao-existe',
        patch: { nome: 'X' },
      });
      expect(depois.participantes).toEqual(antes.participantes);
    });

    it('remove por id', () => {
      let d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana', 'Ana', 'Bia'],
      });
      const id = d.participantes[1]?.id ?? '';
      d = draftReducer(d, { type: 'removerParticipante', id });
      expect(d.participantes.map((p) => p.nome)).toEqual(['Ana', 'Bia']);
      expect(d.participantes.some((p) => p.id === id)).toBe(false);
    });
  });

  describe('resultado', () => {
    it('registrarResultado guarda resultado e mapa', () => {
      const d = comResultado();
      expect(d.resultado?.secoes.resumo).toHaveLength(1);
      expect(d.mapa).toEqual(MAPA);
    });

    it('substituirSecao por IA grava blocos, avisos e atribuição e tira de editadas', () => {
      let d = comResultado();
      d = draftReducer(d, {
        type: 'substituirSecao',
        chave: 'resumo',
        blocos: [{ tipo: 'lista', texto: '', itens: ['a'] }],
        avisos: [],
        atribuicao: null,
        mapa: null,
      });
      expect(d.resultado?.editadas).toEqual(['resumo']);
      d = draftReducer(d, {
        type: 'substituirSecao',
        chave: 'resumo',
        blocos: [{ tipo: 'paragrafo', texto: 'novo', itens: [] }],
        avisos: ['aviso'],
        atribuicao: { ...ATRIB, provedor: 'gemini', fallbackDe: ['openai'] },
        mapa: { ...MAPA, counters: { CPF: 1 } },
      });
      expect(d.resultado?.secoes.resumo?.[0]?.texto).toBe('novo');
      expect(d.resultado?.avisos.resumo).toEqual(['aviso']);
      expect(d.resultado?.atribuicao.resumo?.provedor).toBe('gemini');
      expect(d.resultado?.editadas).toEqual([]);
      expect(d.mapa?.counters).toEqual({ CPF: 1 });
    });

    it('substituirSecao com atribuição null marca editada uma só vez e preserva o mapa', () => {
      let d = comResultado();
      const acao: DraftAction = {
        type: 'substituirSecao',
        chave: 'resumo',
        blocos: [{ tipo: 'paragrafo', texto: 'à mão', itens: [] }],
        avisos: [],
        atribuicao: null,
        mapa: null,
      };
      d = draftReducer(d, acao);
      d = draftReducer(d, acao);
      expect(d.resultado?.editadas).toEqual(['resumo']);
      expect(d.mapa).toEqual(MAPA);
    });

    it('substituirSecao sem resultado é ignorado', () => {
      const antes = criarRascunho();
      const depois = draftReducer(antes, {
        type: 'substituirSecao',
        chave: 'resumo',
        blocos: [],
        avisos: [],
        atribuicao: null,
        mapa: null,
      });
      expect(depois).toBe(antes);
    });

    it('substituirEncaminhamentos usa a chave "encaminhamentos"', () => {
      let d = comResultado();
      d = draftReducer(d, {
        type: 'substituirEncaminhamentos',
        itens: [{ acao: 'N', responsavel: 'R', prazo: '', status: 'concluido' }],
        avisos: ['x'],
        atribuicao: null,
        mapa: null,
      });
      expect(d.resultado?.encaminhamentos).toHaveLength(1);
      expect(d.resultado?.encaminhamentos[0]?.status).toBe('concluido');
      expect(d.resultado?.avisos.encaminhamentos).toEqual(['x']);
      expect(d.resultado?.editadas).toEqual(['encaminhamentos']);
      d = draftReducer(d, {
        type: 'substituirEncaminhamentos',
        itens: [],
        avisos: [],
        atribuicao: ATRIB,
        mapa: MAPA,
      });
      expect(d.resultado?.atribuicao.encaminhamentos).toEqual(ATRIB);
      expect(d.resultado?.editadas).toEqual([]);
    });
  });

  it('novaAta preserva tipo e tom e zera o resto', () => {
    let d = comResultado();
    d = draftReducer(d, { type: 'definirTipo', tipoId: 'assembleia' });
    d = draftReducer(d, { type: 'definirTom', tom: 'detalhado' });
    d = draftReducer(d, { type: 'definirCampo', campo: 'assunto', valor: 'X' });
    d = draftReducer(d, { type: 'definirPauta', itens: ['A'] });
    d = draftReducer(d, { type: 'adicionarParticipantes', nomes: ['Ana'] });
    d = draftReducer(d, { type: 'definirTranscricao', texto: 'fala' });
    d = draftReducer(d, { type: 'novaAta' });
    expect(d).toEqual({ ...criarRascunho('assembleia'), tom: 'detalhado' });
  });
});
