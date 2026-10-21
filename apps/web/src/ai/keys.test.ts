import { describe, expect, it, vi } from 'vitest';
import { MODELOS } from '../config/models';
import { CHAVES } from '../config/storage-keys';
import { criarKeyStore, type ChaveProvedor } from './keys';

/** Storage em memória que registra o que foi escrito. */
function storageFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  const setItem = vi.fn((k: string, v: string) => {
    dados.set(k, v);
  });
  const removeItem = vi.fn((k: string) => {
    dados.delete(k);
  });
  const storage = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem,
    removeItem,
    clear: () => {
      dados.clear();
    },
    key: () => null,
    get length() {
      return dados.size;
    },
  } satisfies Storage;
  return { storage, dados, setItem, removeItem };
}

const CHAVE_OPENAI = 'sk-teste-ficticia-0001';
const CHAVE_GEMINI = 'AIzaTesteFicticia0002';

function chave(parcial: Partial<ChaveProvedor> = {}): ChaveProvedor {
  return {
    provedor: 'openai',
    chave: CHAVE_OPENAI,
    modelo: MODELOS.openai.padrao,
    estado: 'nao_testada',
    ...parcial,
  };
}

describe('criarKeyStore', () => {
  it('sem "lembrar", nada vai para o storage', () => {
    const { storage, setItem, dados } = storageFalso();
    const store = criarKeyStore(storage);
    store.definir(chave());
    store.definir(
      chave({ provedor: 'gemini', chave: CHAVE_GEMINI, modelo: MODELOS.gemini.padrao }),
    );
    store.reordenar(['gemini', 'openai', 'anthropic']);
    store.remover('openai');
    expect(store.lembrar()).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(dados.size).toBe(0);
    expect(store.cadeia().map((c) => c.id)).toEqual(['gemini']);
  });

  it('com "lembrar", salva em CHAVES e restaura num novo store (estado volta a "não testada")', () => {
    const { storage, dados } = storageFalso();
    const a = criarKeyStore(storage);
    a.definirLembrar(true);
    a.definir(chave({ estado: 'ok' }));
    a.definir(chave({ provedor: 'gemini', chave: CHAVE_GEMINI, modelo: 'gemini-x' }));
    a.reordenar(['gemini', 'anthropic', 'openai']);
    expect(dados.has(CHAVES)).toBe(true);

    const b = criarKeyStore(storage);
    expect(b.lembrar()).toBe(true);
    expect(b.ordem()).toEqual(['gemini', 'anthropic', 'openai']);
    expect(b.listar()).toEqual([
      { provedor: 'gemini', chave: CHAVE_GEMINI, modelo: 'gemini-x', estado: 'nao_testada' },
      chave(),
    ]);
  });

  it('marcar "lembrar" persiste as chaves que já estavam na memória', () => {
    const { storage, dados } = storageFalso();
    const store = criarKeyStore(storage);
    store.definir(chave());
    expect(dados.size).toBe(0);
    store.definirLembrar(true);
    expect(dados.get(CHAVES)).toContain(CHAVE_OPENAI);
  });

  it('desmarcar "lembrar" apaga do storage na hora e mantém a memória', () => {
    const { storage, dados } = storageFalso();
    const store = criarKeyStore(storage);
    store.definirLembrar(true);
    store.definir(chave());
    store.definirLembrar(false);
    expect(dados.has(CHAVES)).toBe(false);
    expect(store.lembrar()).toBe(false);
    expect(store.cadeia()).toHaveLength(1);
    // Mudanças seguintes não voltam a gravar.
    store.definir(chave({ chave: 'sk-outra-0003' }));
    expect(dados.has(CHAVES)).toBe(false);
  });

  it('remover a última chave com "lembrar" tira o item do storage', () => {
    const { storage, dados } = storageFalso();
    const store = criarKeyStore(storage);
    store.definirLembrar(true);
    store.definir(chave());
    expect(dados.has(CHAVES)).toBe(true);
    store.remover('openai');
    expect(dados.has(CHAVES)).toBe(false);
  });

  it('apagarTudo limpa memória e storage, e desliga "lembrar"', () => {
    const { storage, dados } = storageFalso();
    const store = criarKeyStore(storage);
    store.definirLembrar(true);
    store.definir(chave());
    store.reordenar(['anthropic', 'gemini', 'openai']);
    store.apagarTudo();
    expect(store.listar()).toEqual([]);
    expect(store.cadeia()).toEqual([]);
    expect(store.lembrar()).toBe(false);
    expect(store.ordem()).toEqual(['openai', 'gemini', 'anthropic']);
    expect(dados.has(CHAVES)).toBe(false);
  });

  it('cadeia() respeita a ordem de preferência e omite provedores sem chave', () => {
    const store = criarKeyStore(null);
    store.definir(chave({ provedor: 'anthropic', chave: 'sk-ant-teste-0004', modelo: 'claude-x' }));
    store.definir(chave());
    store.reordenar(['anthropic', 'gemini', 'openai']);
    expect(store.cadeia()).toEqual([
      { id: 'anthropic', modelo: 'claude-x', chave: 'sk-ant-teste-0004' },
      { id: 'openai', modelo: MODELOS.openai.padrao, chave: CHAVE_OPENAI },
    ]);
  });

  it('apara espaços da chave e do modelo; modelo vazio vira o padrão do provedor', () => {
    const store = criarKeyStore(null);
    store.definir(chave({ chave: `  ${CHAVE_OPENAI}\n`, modelo: '   ' }));
    expect(store.cadeia()).toEqual([
      { id: 'openai', modelo: MODELOS.openai.padrao, chave: CHAVE_OPENAI },
    ]);
    store.definir(chave({ modelo: '  gpt-livre  ' }));
    expect(store.cadeia()[0]?.modelo).toBe('gpt-livre');
  });

  it('chave vazia equivale a remover', () => {
    const store = criarKeyStore(null);
    store.definir(chave());
    store.definir(chave({ chave: '  ' }));
    expect(store.listar()).toEqual([]);
  });

  it('reordenar ignora ids repetidos/desconhecidos e completa o que faltar', () => {
    const store = criarKeyStore(null);
    store.reordenar(['gemini', 'gemini', 'xyz' as never]);
    expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
  });

  it('JSON corrompido ou de formato inesperado no storage é ignorado, sem lançar', () => {
    for (const lixo of [
      '{nao-e-json',
      'null',
      '42',
      '[]',
      '{"chaves":"x"}',
      '{"chaves":[{"provedor":"outro","chave":"k","modelo":"m"}]}',
      '{"chaves":[{"provedor":"openai","chave":7,"modelo":"m"}]}',
    ]) {
      const { storage } = storageFalso({ [CHAVES]: lixo });
      const store = criarKeyStore(storage);
      expect(store.listar()).toEqual([]);
      expect(store.lembrar()).toBe(false);
      expect(store.ordem()).toEqual(['openai', 'gemini', 'anthropic']);
    }
  });

  it('aproveita as entradas válidas de um JSON parcialmente válido', () => {
    const bom = { provedor: 'gemini', chave: CHAVE_GEMINI, modelo: 'm' };
    const { storage } = storageFalso({
      [CHAVES]: JSON.stringify({ chaves: [bom, { provedor: 'openai', chave: 1 }], ordem: ['x'] }),
    });
    const store = criarKeyStore(storage);
    expect(store.listar().map((c) => c.provedor)).toEqual(['gemini']);
    expect(store.lembrar()).toBe(true);
    expect(store.ordem()).toEqual(['openai', 'gemini', 'anthropic']);
  });

  it('storage que lança (modo privado) não derruba nada', () => {
    const falho = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage;
    const store = criarKeyStore(falho);
    expect(() => {
      store.definirLembrar(true);
      store.definir(chave());
      store.definirLembrar(false);
      store.apagarTudo();
    }).not.toThrow();
  });

  it('assinantes são avisados a cada mudança, e param ao cancelar a assinatura', () => {
    const store = criarKeyStore(null);
    const ouvinte = vi.fn();
    const cancelar = store.assinar(ouvinte);
    const antes = store.revisao();
    store.definir(chave());
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(store.revisao()).toBeGreaterThan(antes);
    cancelar();
    store.remover('openai');
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
