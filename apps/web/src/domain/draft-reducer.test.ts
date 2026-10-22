import type { MaskMap } from '@lavra/pii-br';
import { describe, expect, it } from 'vitest';
import { LIMITE_PARTICIPANTES } from '../config/limits';
import type { AtaDraft, Atribuicao, DraftAction, ResultadoAta } from './draft';
import { criarRascunho, draftReducer, temConteudo } from './draft-reducer';

const MAPA: MaskMap = {
  version: 1,
  markers: { '[CPF_1]': '529.982.247-25' },
  keys: {},
  counters: {},
};
const ATRIB: Atribuicao = { provedor: 'openai', modelo: 'm', falhas: [] };

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

  it('aceita o tipo e o tom (preferências lembradas)', () => {
    const d = criarRascunho('cipa', 'conciso');
    expect(d.tipoId).toBe('cipa');
    expect(d.tom).toBe('conciso');
  });
});

describe('substituirRascunho', () => {
  it('devolve exatamente o rascunho passado (o exemplo entra inteiro, nada do anterior sobra)', () => {
    const anterior = { ...criarRascunho('corporativa', 'conciso'), transcricao: 'Ana: olá.' };
    const novo = comResultado();
    expect(draftReducer(anterior, { type: 'substituirRascunho', rascunho: novo })).toBe(novo);
  });
});

describe('temConteudo', () => {
  it('rascunho só com tipo e tom não tem conteúdo', () => {
    expect(temConteudo(criarRascunho('cipa', 'conciso'))).toBe(false);
    expect(temConteudo({ ...criarRascunho(), dados: { assunto: '   ' } })).toBe(false);
  });

  it('dado, pauta, participante, transcrição ou ata gerada contam como conteúdo', () => {
    const base = criarRascunho();
    expect(temConteudo({ ...base, dados: { assunto: 'Reembolsos' } })).toBe(true);
    expect(temConteudo({ ...base, pauta: ['Item'] })).toBe(true);
    expect(temConteudo({ ...base, transcricao: 'Ana: olá.' })).toBe(true);
    expect(temConteudo(comResultado())).toBe(true);
    expect(
      temConteudo({
        ...base,
        participantes: [
          { id: 'p1', nome: 'Ana', papel: '', presenca: 'presente', justificativa: '', extras: {} },
        ],
      }),
    ).toBe(true);
  });
});

describe('draftReducer', () => {
  it('definirTipo e definirTom', () => {
    let d = draftReducer(criarRascunho(), { type: 'definirTipo', tipoId: 'condominio' });
    d = draftReducer(d, { type: 'definirTom', tom: 'conciso' });
    expect(d.tipoId).toBe('condominio');
    expect(d.tom).toBe('conciso');
  });

  describe('definirTipo troca o tipo sem perder o que a pessoa digitou', () => {
    it('zera só o resultado e mantém dados (inclusive ids de outro tipo), pauta, participantes, transcrição, mapa e tom', () => {
      let d = comResultado();
      d = draftReducer(d, { type: 'definirTom', tom: 'detalhado' });
      d = draftReducer(d, { type: 'definirCampo', campo: 'organizacao', valor: 'Empresa Exemplo' });
      d = draftReducer(d, { type: 'definirCampo', campo: 'data', valor: '2026-10-14' });
      d = draftReducer(d, { type: 'definirPauta', itens: ['A', 'B'] });
      d = draftReducer(d, { type: 'adicionarParticipantes', nomes: ['Ana'] });
      const id = d.participantes[0]?.id ?? '';
      d = draftReducer(d, {
        type: 'atualizarParticipante',
        id,
        patch: { extras: { unidade: 'Apto 101' } },
      });
      d = draftReducer(d, { type: 'definirTranscricao', texto: 'fala' });

      const depois = draftReducer(d, { type: 'definirTipo', tipoId: 'outro' });

      expect(depois.tipoId).toBe('outro');
      expect(depois.resultado).toBeNull();
      expect(depois.dados).toEqual(d.dados);
      expect(depois.pauta).toEqual(['A', 'B']);
      expect(depois.participantes).toEqual(d.participantes);
      expect(depois.participantes[0]?.extras).toEqual({ unidade: 'Apto 101' });
      expect(depois.transcricao).toBe('fala');
      expect(depois.mapa).toEqual(MAPA);
      expect(depois.tom).toBe('detalhado');
    });
  });

  describe('definirTipo e a plataforma da reunião remota (exceção D2)', () => {
    function remotaComPlataforma(): AtaDraft {
      let d = criarRascunho('corporativa');
      d = draftReducer(d, { type: 'definirCampo', campo: 'modalidade', valor: 'remota' });
      return draftReducer(d, { type: 'definirCampo', campo: 'local', valor: 'videoconferência' });
    }

    it('a plataforma da corporativa não vira o local da CIPA e volta ao `local` ao retornar', () => {
      const naCipa = draftReducer(remotaComPlataforma(), { type: 'definirTipo', tipoId: 'cipa' });
      expect(naCipa.dados.local).toBeUndefined();
      expect(naCipa.dados.plataforma).toBe('videoconferência');
      expect(naCipa.dados.modalidade).toBe('remota');

      const devolta = draftReducer(naCipa, { type: 'definirTipo', tipoId: 'corporativa' });
      expect(devolta.dados).toEqual(remotaComPlataforma().dados);
    });

    it('local e plataforma preenchidos (Ltda: sede e Teams) trocam de campo sem perder nenhum', () => {
      let d = criarRascunho('socios-ltda');
      d = draftReducer(d, { type: 'definirCampo', campo: 'modalidade', valor: 'remota' });
      d = draftReducer(d, { type: 'definirCampo', campo: 'local', valor: 'Sede' });
      d = draftReducer(d, { type: 'definirCampo', campo: 'plataforma', valor: 'Teams' });

      const naCorporativa = draftReducer(d, { type: 'definirTipo', tipoId: 'corporativa' });
      expect(naCorporativa.dados.local).toBe('Teams');
      expect(naCorporativa.dados.plataforma).toBe('Sede');

      const devolta = draftReducer(naCorporativa, { type: 'definirTipo', tipoId: 'socios-ltda' });
      expect(devolta.dados).toEqual(d.dados);
    });
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

    it('complementos acompanha os nomes pela posição, mesmo com linhas vazias no meio', () => {
      const d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana Souza', '', 'Bruno Lima', 'Carla Dias'],
        complementos: ['Diretora', 'Ignorado', ' Analista ', ''],
      });
      expect(d.participantes.map((p) => [p.nome, p.papel])).toEqual([
        ['Ana Souza', 'Diretora'],
        ['Bruno Lima', 'Analista'],
        ['Carla Dias', ''],
      ]);
    });

    it('destino grava o complemento no extra e deixa o papel vazio', () => {
      const d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana Souza', 'Bruno Lima'],
        complementos: [' Apto 101 ', ''],
        destino: 'unidade',
      });
      expect(d.participantes.map((p) => [p.nome, p.papel, p.extras])).toEqual([
        ['Ana Souza', '', { unidade: 'Apto 101' }],
        ['Bruno Lima', '', {}],
      ]);
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
        atribuicao: {
          ...ATRIB,
          provedor: 'gemini',
          falhas: [{ provedor: 'openai', erro: 'limite' }],
        },
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

  describe('preencherExtrasVazios', () => {
    function comTres(): AtaDraft {
      let d = draftReducer(criarRascunho(), {
        type: 'adicionarParticipantes',
        nomes: ['Ana', 'Bruno', 'Carla'],
      });
      const [a, b, c] = d.participantes;
      d = draftReducer(d, {
        type: 'atualizarParticipante',
        id: b?.id ?? '',
        patch: { extras: { vinculo: 'procurador' } },
      });
      d = draftReducer(d, {
        type: 'atualizarParticipante',
        id: c?.id ?? '',
        patch: { extras: { vinculo: '   ' } },
      });
      expect(a).toBeDefined();
      return d;
    }

    it('só altera quem está vazio e não toca no id', () => {
      const antes = comTres();
      const depois = draftReducer(antes, {
        type: 'preencherExtrasVazios',
        campo: 'vinculo',
        valor: 'proprietario',
      });
      expect(depois.participantes.map((p) => p.extras.vinculo)).toEqual([
        'proprietario',
        'procurador',
        'proprietario',
      ]);
      expect(depois.participantes.map((p) => p.id)).toEqual(antes.participantes.map((p) => p.id));
      // Quem já tinha valor segue sendo o mesmo objeto (a linha memoizada não redesenha).
      expect(depois.participantes[1]).toBe(antes.participantes[1]);
    });

    it('espaços e caracteres de espaço contam como vazio (mesmo critério da validação)', () => {
      const base = comTres();
      const d = draftReducer(base, {
        type: 'atualizarParticipante',
        id: base.participantes[0]?.id ?? '',
        patch: { extras: { vinculo: '\u00a0 ' } },
      });
      expect(d.participantes[0]?.extras.vinculo).toBe('\u00a0 ');
      const depois = draftReducer(d, {
        type: 'preencherExtrasVazios',
        campo: 'vinculo',
        valor: 'proprietario',
      });
      expect(depois.participantes[0]?.extras.vinculo).toBe('proprietario');
    });

    it('limparExtra desfaz o preenchimento só nos ids pedidos', () => {
      const antes = comTres();
      const preenchido = draftReducer(antes, {
        type: 'preencherExtrasVazios',
        campo: 'vinculo',
        valor: 'proprietario',
      });
      const ids = [antes.participantes[0]?.id ?? '', antes.participantes[2]?.id ?? ''];
      const depois = draftReducer(preenchido, { type: 'limparExtra', campo: 'vinculo', ids });
      expect(depois.participantes.map((p) => p.extras.vinculo)).toEqual([
        undefined,
        'procurador',
        undefined,
      ]);
      expect(depois.participantes[1]).toBe(preenchido.participantes[1]);
    });

    it('sem ninguém vazio, devolve o mesmo estado', () => {
      const cheio = draftReducer(comTres(), {
        type: 'preencherExtrasVazios',
        campo: 'vinculo',
        valor: 'proprietario',
      });
      expect(
        draftReducer(cheio, { type: 'preencherExtrasVazios', campo: 'vinculo', valor: 'x' }),
      ).toBe(cheio);
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
