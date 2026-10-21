import { describe, expect, it } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import { construirDocumento } from '../../document/build-model';
import type { DocBloco } from '../../document/model';
import type { ResultadoAta } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { comSecoesVazias } from './secoes-vazias';

function resultado(parcial: Partial<ResultadoAta['secoes']>, comEncaminhamentos = true) {
  const r: ResultadoAta = {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: 'Resumo.', itens: [] }],
      discussao: [{ tipo: 'paragrafo', texto: 'Discussão.', itens: [] }],
      decisoes: [{ tipo: 'paragrafo', texto: 'Decisões.', itens: [] }],
      pendencias: [{ tipo: 'paragrafo', texto: 'Pendências.', itens: [] }],
      riscos: [{ tipo: 'paragrafo', texto: 'Riscos.', itens: [] }],
      proxima_reuniao: [{ tipo: 'paragrafo', texto: 'Próxima.', itens: [] }],
      ...parcial,
    },
    encaminhamentos: comEncaminhamentos
      ? [{ acao: 'Fazer', responsavel: 'Ana', prazo: '', status: 'pendente' }]
      : [],
    atribuicao: {},
    avisos: {},
    editadas: [],
  };
  return r;
}

function modelo(r: ResultadoAta) {
  const d = { ...criarRascunho(), dados: { data: '2026-10-14' }, resultado: r };
  return construirDocumento(d, corporativa);
}

const chaves = (blocos: DocBloco[]) => blocos.flatMap((b) => (b.tipo === 'secao' ? [b.chave] : []));

describe('comSecoesVazias', () => {
  it('o DocumentModel continua sem seções vazias (PDF e DOCX dependem disso)', () => {
    const m = modelo(resultado({ riscos: [] }, false));
    expect(chaves(m.blocos)).not.toContain('riscos');
    expect(chaves(m.blocos)).not.toContain('encaminhamentos');
  });

  it('insere a seção vazia na posição do documento, sem mexer no modelo', () => {
    const m = modelo(resultado({ riscos: [] }));
    const antes = structuredClone(m.blocos);
    const tela = comSecoesVazias(m.blocos, corporativa);
    expect(chaves(tela)).toEqual([
      'resumo',
      'discussao',
      'decisoes',
      'pendencias',
      'riscos',
      'proxima_reuniao',
      'encaminhamentos',
    ]);
    expect(m.blocos).toEqual(antes);
    const riscos = tela.find((b) => b.tipo === 'secao' && b.chave === 'riscos');
    expect(riscos).toMatchObject({ titulo: 'Riscos', blocos: [], gerada: true });
  });

  it('seções vazias no fim (e encaminhamentos vazios) ficam antes do fecho', () => {
    const m = modelo(resultado({ proxima_reuniao: [] }, false));
    const tela = comSecoesVazias(m.blocos, corporativa);
    expect(chaves(tela).slice(-2)).toEqual(['proxima_reuniao', 'encaminhamentos']);
    const fecho = tela.findLastIndex((b) => b.tipo === 'paragrafo');
    const ultimaSecao = tela.findLastIndex((b) => b.tipo === 'secao');
    expect(ultimaSecao).toBe(fecho - 1);
  });

  it('tudo vazio: todas as seções entram antes do fecho, na ordem do tipo', () => {
    const vazias = Object.fromEntries(corporativa.secoes.map((s) => [s.chave, []]));
    const tela = comSecoesVazias(modelo(resultado(vazias, false)).blocos, corporativa);
    expect(chaves(tela)).toEqual([...corporativa.secoes.map((s) => s.chave), 'encaminhamentos']);
  });

  it('nada a inserir: devolve os mesmos blocos', () => {
    const m = modelo(resultado({}));
    expect(comSecoesVazias(m.blocos, corporativa)).toBe(m.blocos);
  });
});
