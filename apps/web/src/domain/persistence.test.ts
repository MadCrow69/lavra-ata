import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RASCUNHO } from '../config/storage-keys';
import type { AtaDraft } from './draft';
import { criarRascunho, draftReducer } from './draft-reducer';
import { carregarRascunho, salvarRascunho } from './persistence';

function rascunhoCompleto(): AtaDraft {
  let d = criarRascunho('corporativa');
  d = draftReducer(d, { type: 'definirCampo', campo: 'assunto', valor: 'Planejamento' });
  d = draftReducer(d, { type: 'definirPauta', itens: ['Abertura'] });
  d = draftReducer(d, { type: 'adicionarParticipantes', nomes: ['Ana Souza'] });
  d = draftReducer(d, { type: 'definirTranscricao', texto: 'Ana: bom dia.' });
  return draftReducer(d, {
    type: 'registrarResultado',
    mapa: { version: 1, markers: { '[CPF_1]': '529.982.247-25' }, keys: {}, counters: { CPF: 1 } },
    resultado: {
      secoes: { resumo: [{ tipo: 'paragrafo', texto: 'Resumo', itens: [] }] },
      encaminhamentos: [],
      atribuicao: { resumo: { provedor: 'openai', modelo: 'm', falhas: [] } },
      avisos: {},
      editadas: [],
    },
  });
}

const MAPA = {
  version: 1,
  markers: { '[CPF_1]': '529.982.247-25' },
  keys: {},
  counters: { CPF: 1 },
};

function comParticipante(patch: Record<string, unknown>): unknown {
  const d = rascunhoCompleto();
  return { ...d, participantes: [{ ...d.participantes[0], ...patch }] };
}

function comResultado(patch: Record<string, unknown>): unknown {
  const d = rascunhoCompleto();
  return { ...d, resultado: { ...d.resultado, ...patch } };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('persistência do rascunho', () => {
  it('ida e volta', () => {
    const d = rascunhoCompleto();
    salvarRascunho(d);
    expect(carregarRascunho()).toEqual(d);
  });

  it('grava na chave RASCUNHO do sessionStorage e nunca no localStorage', () => {
    salvarRascunho(rascunhoCompleto());
    expect(sessionStorage.getItem(RASCUNHO)).not.toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('sem nada salvo → null', () => {
    expect(carregarRascunho()).toBeNull();
  });

  it('JSON corrompido → null', () => {
    sessionStorage.setItem(RASCUNHO, '{nao e json');
    expect(carregarRascunho()).toBeNull();
  });

  it.each([
    ['versão diferente', { ...rascunhoCompleto(), versao: 2 }],
    ['sem versão', { ...rascunhoCompleto(), versao: undefined }],
    ['tom inválido', { ...rascunhoCompleto(), tom: 'gritado' }],
    ['tipoId não string', { ...rascunhoCompleto(), tipoId: 3 }],
    ['pauta não é lista', { ...rascunhoCompleto(), pauta: 'A' }],
    ['participantes não é lista', { ...rascunhoCompleto(), participantes: {} }],
    ['participante sem id', { ...rascunhoCompleto(), participantes: [{ nome: 'Ana' }] }],
    ['transcricao ausente', { ...rascunhoCompleto(), transcricao: undefined }],
    ['dados não é objeto', { ...rascunhoCompleto(), dados: [] }],
    ['mapa de tipo errado', { ...rascunhoCompleto(), mapa: 'x' }],
    ['resultado de tipo errado', { ...rascunhoCompleto(), resultado: 1 }],
    ['resultado vazio', { ...rascunhoCompleto(), resultado: {} }],
    ['mapa vazio', { ...rascunhoCompleto(), mapa: {} }],
    ['mapa com versão errada', { ...rascunhoCompleto(), mapa: { ...MAPA, version: 2 } }],
    [
      'mapa com marcador não texto',
      { ...rascunhoCompleto(), mapa: { ...MAPA, markers: { a: 1 } } },
    ],
    [
      'mapa com contador não numérico',
      { ...rascunhoCompleto(), mapa: { ...MAPA, counters: { CPF: 'x' } } },
    ],
    ['participante sem nome', { ...rascunhoCompleto(), participantes: [{ id: 'x' }] }],
    ['participante com presença inválida', comParticipante({ presenca: 'talvez' })],
    ['participante com extras não texto', comParticipante({ extras: { a: 1 } })],
    ['dados com número', { ...rascunhoCompleto(), dados: { assunto: 3 } }],
    ['pauta com número', { ...rascunhoCompleto(), pauta: ['A', 2] }],
    [
      'bloco com tipo inválido',
      comResultado({ secoes: { resumo: [{ tipo: 'x', texto: '', itens: [] }] } }),
    ],
    ['bloco sem itens', comResultado({ secoes: { resumo: [{ tipo: 'lista', texto: '' }] } })],
    ['seção que não é lista', comResultado({ secoes: { resumo: 'texto' } })],
    [
      'encaminhamento com status inválido',
      comResultado({ encaminhamentos: [{ acao: 'a', responsavel: 'b', prazo: '', status: 'x' }] }),
    ],
    [
      'encaminhamento sem ação',
      comResultado({ encaminhamentos: [{ responsavel: 'b', prazo: '', status: 'pendente' }] }),
    ],
    [
      'atribuição com provedor inválido',
      comResultado({ atribuicao: { resumo: { provedor: 'x', modelo: 'm', falhas: [] } } }),
    ],
    [
      'falha anterior com motivo desconhecido',
      comResultado({
        atribuicao: {
          resumo: { provedor: 'gemini', modelo: 'm', falhas: [{ provedor: 'openai', erro: 'x' }] },
        },
      }),
    ],
    [
      'falha anterior com provedor inválido',
      comResultado({
        atribuicao: {
          resumo: { provedor: 'gemini', modelo: 'm', falhas: [{ provedor: 'x', erro: 'limite' }] },
        },
      }),
    ],
    [
      'atribuição sem falhas nem fallbackDe',
      comResultado({ atribuicao: { resumo: { provedor: 'gemini', modelo: 'm' } } }),
    ],
    ['avisos com número', comResultado({ avisos: { resumo: [1] } })],
    ['editadas que não é lista', comResultado({ editadas: 'resumo' })],
    ['valor que não é objeto', 42],
    ['null', null],
  ])('formato inválido (%s) → null', (_nome, valor) => {
    sessionStorage.setItem(RASCUNHO, JSON.stringify(valor));
    expect(carregarRascunho()).toBeNull();
  });

  it('sessionStorage que lança ao gravar não quebra', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    expect(() => {
      salvarRascunho(rascunhoCompleto());
    }).not.toThrow();
  });

  it('sessionStorage que lança ao ler não quebra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError');
    });
    expect(carregarRascunho()).toBeNull();
  });

  it('o próprio acessor sessionStorage lançar (modo privado) não quebra', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('negado', 'SecurityError');
      },
    });
    try {
      expect(() => {
        salvarRascunho(rascunhoCompleto());
      }).not.toThrow();
      expect(carregarRascunho()).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('aceita mapa com "reserved" e resultado com encaminhamentos', () => {
    const base = rascunhoCompleto();
    const d = {
      ...base,
      mapa: { ...MAPA, reserved: { CPF: ['2'] } } as AtaDraft['mapa'],
      resultado: {
        ...(
          comResultado({
            encaminhamentos: [
              { acao: 'A', responsavel: 'B', prazo: '2026-11-01', status: 'concluido' },
            ],
          }) as AtaDraft
        ).resultado,
      } as AtaDraft['resultado'],
    };
    salvarRascunho(d);
    expect(carregarRascunho()).toEqual(d);
  });

  it('atribuição com o motivo de cada falha faz ida e volta', () => {
    const d = comResultado({
      atribuicao: {
        resumo: {
          provedor: 'gemini',
          modelo: 'm',
          falhas: [{ provedor: 'openai', erro: 'limite' }],
        },
      },
    }) as AtaDraft;
    salvarRascunho(d);
    expect(carregarRascunho()).toEqual(d);
  });

  it('rascunho de versão anterior (só `fallbackDe`) carrega, com a falha sem motivo', () => {
    const antigo = comResultado({
      atribuicao: {
        resumo: { provedor: 'gemini', modelo: 'm', fallbackDe: ['openai'] },
        decisoes: { provedor: 'openai', modelo: 'm', fallbackDe: [] },
      },
    });
    sessionStorage.setItem(RASCUNHO, JSON.stringify(antigo));
    expect(carregarRascunho()?.resultado?.atribuicao).toEqual({
      resumo: { provedor: 'gemini', modelo: 'm', falhas: [{ provedor: 'openai' }] },
      decisoes: { provedor: 'openai', modelo: 'm', falhas: [] },
    });
  });

  it('a chave de API nunca aparece no JSON salvo', () => {
    salvarRascunho(rascunhoCompleto());
    const bruto = sessionStorage.getItem(RASCUNHO) ?? '';
    expect(bruto).not.toMatch(/sk-/);
    expect(bruto).not.toMatch(/AIza/);
    expect(bruto).not.toMatch(/apiKey|chave/i);
  });
});
