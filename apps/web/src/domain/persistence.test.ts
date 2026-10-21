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
      atribuicao: { resumo: { provedor: 'openai', modelo: 'm', fallbackDe: [] } },
      avisos: {},
      editadas: [],
    },
  });
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

  it('a chave de API nunca aparece no JSON salvo', () => {
    salvarRascunho(rascunhoCompleto());
    const bruto = sessionStorage.getItem(RASCUNHO) ?? '';
    expect(bruto).not.toMatch(/sk-/);
    expect(bruto).not.toMatch(/AIza/);
    expect(bruto).not.toMatch(/apiKey|chave/i);
  });
});
