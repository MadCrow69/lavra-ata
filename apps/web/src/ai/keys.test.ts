import { describe, expect, it, vi } from 'vitest';
import { MODELOS } from '../config/models';
import { CHAVES } from '../config/storage-keys';
import { criarKeyStore, type ChaveProvedor } from './keys';
import type { ProviderId } from './types';

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
    expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
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
      expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
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
    expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
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

  it('definirEstado grava só o veredito: mantém o modelo e ignora chave que já não é a testada', () => {
    const store = criarKeyStore(null);
    store.definir(chave({ modelo: 'modelo-a' }));
    // A pessoa trocou o modelo enquanto o teste rodava.
    store.definir(chave({ modelo: 'modelo-b' }));
    store.definirEstado('openai', CHAVE_OPENAI, 'ok');
    expect(store.listar()[0]).toMatchObject({ modelo: 'modelo-b', estado: 'ok' });

    // A chave foi trocada: o veredito do teste antigo não vale para a nova.
    store.definir(chave({ chave: 'sk-nova-0005' }));
    store.definirEstado('openai', CHAVE_OPENAI, 'invalida');
    expect(store.listar()[0]).toMatchObject({ chave: 'sk-nova-0005', estado: 'nao_testada' });

    // Provedor sem chave: nada acontece (e não cria entrada).
    store.definirEstado('gemini', CHAVE_GEMINI, 'ok');
    expect(store.listar().map((c) => c.provedor)).toEqual(['openai']);
  });

  it('o motivo da recusa vale só com "inválida" e some ao trocar a chave ou o veredito', () => {
    const store = criarKeyStore(null);
    store.definir(chave());
    store.definirEstado('openai', CHAVE_OPENAI, 'invalida', 'sem_credito');
    expect(store.listar()[0]).toMatchObject({ estado: 'invalida', motivo: 'sem_credito' });

    // Só o modelo mudou (o cartão repassa o estado e a marca): continua.
    store.definir(chave({ modelo: 'modelo-b', estado: 'invalida', motivo: 'sem_credito' }));
    expect(store.listar()[0]).toMatchObject({ modelo: 'modelo-b', motivo: 'sem_credito' });

    // Chave nova, não testada: a marca cai.
    store.definir(chave({ chave: 'sk-nova-0007' }));
    expect(store.listar()[0]?.motivo).toBeUndefined();

    // "Inválida" comum (sem a marca) também apaga a marca anterior.
    store.definirEstado('openai', 'sk-nova-0007', 'invalida', 'sem_credito');
    store.definirEstado('openai', 'sk-nova-0007', 'invalida');
    expect(store.listar()[0]?.motivo).toBeUndefined();
  });

  it('chave com estado "inválida" fica fora da cadeia, mas continua listada; editar a chave a traz de volta', () => {
    const store = criarKeyStore(null);
    store.definir(chave());
    store.definir(chave({ provedor: 'gemini', chave: CHAVE_GEMINI }));
    store.definirEstado('openai', CHAVE_OPENAI, 'invalida');
    expect(store.cadeia().map((c) => c.id)).toEqual(['gemini']);
    expect(store.listar().map((c) => c.provedor)).toEqual(['gemini', 'openai']);

    store.definirEstado('gemini', CHAVE_GEMINI, 'invalida');
    expect(store.cadeia()).toEqual([]);

    store.definir(chave({ chave: 'sk-corrigida-0006', estado: 'nao_testada' }));
    expect(store.cadeia().map((c) => c.id)).toEqual(['openai']);
  });

  it('ao carregar, modelo vazio vira o padrão e modelo com espaços é aparado', () => {
    const { storage } = storageFalso({
      [CHAVES]: JSON.stringify({
        chaves: [
          { provedor: 'openai', chave: CHAVE_OPENAI, modelo: '   ' },
          { provedor: 'gemini', chave: CHAVE_GEMINI, modelo: '  gem-x ' },
        ],
      }),
    });
    const store = criarKeyStore(storage);
    expect(store.cadeia()).toEqual([
      { id: 'gemini', modelo: 'gem-x', chave: CHAVE_GEMINI },
      { id: 'openai', modelo: MODELOS.openai.padrao, chave: CHAVE_OPENAI },
    ]);
  });

  it('marcar "lembrar" testa a gravação: navegador que bloqueia mantém lembrar=false e avisa', () => {
    const bloqueado = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage;
    const store = criarKeyStore(bloqueado);
    store.definir(chave());
    expect(store.persistenciaIndisponivel()).toBe(false);
    store.definirLembrar(true);
    expect(store.lembrar()).toBe(false);
    expect(store.persistenciaIndisponivel()).toBe(true);
    expect(store.cadeia()).toHaveLength(1);

    // Sem armazenamento nenhum (null) vale o mesmo.
    const semStorage = criarKeyStore(null);
    semStorage.definirLembrar(true);
    expect(semStorage.lembrar()).toBe(false);
    expect(semStorage.persistenciaIndisponivel()).toBe(true);
    // Desmarcar/apagar tudo zera o aviso.
    semStorage.apagarTudo();
    expect(semStorage.persistenciaIndisponivel()).toBe(false);
  });

  it('marcar "lembrar" sem nenhuma chave também testa a gravação e deixa a preferência ligada', () => {
    const { storage, setItem } = storageFalso();
    const store = criarKeyStore(storage);
    store.definirLembrar(true);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(store.lembrar()).toBe(true);
    expect(store.persistenciaIndisponivel()).toBe(false);
  });

  it('falha de gravação depois de ligado ("lembrar") passa a avisar; a próxima gravação boa limpa o aviso', () => {
    let falhar = false;
    const dados = new Map<string, string>();
    const instavel = {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (falhar) throw new Error('cheio');
        dados.set(k, v);
      },
      removeItem: (k: string) => {
        dados.delete(k);
      },
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage;
    const store = criarKeyStore(instavel);
    store.definirLembrar(true);
    falhar = true;
    store.definir(chave());
    expect(store.persistenciaIndisponivel()).toBe(true);
    falhar = false;
    store.definir(chave({ chave: 'sk-outra-0007' }));
    expect(store.persistenciaIndisponivel()).toBe(false);
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

  describe('ordem inicial (preferências)', () => {
    it('sem chaves lembradas, a ordem inicial vale e completa o que faltar', () => {
      const { storage } = storageFalso();
      expect(criarKeyStore(storage, ['anthropic', 'openai']).ordem()).toEqual([
        'anthropic',
        'openai',
        'gemini',
      ]);
    });

    it('com chaves lembradas, a ordem gravada vence a ordem inicial', () => {
      const { storage } = storageFalso();
      const primeira = criarKeyStore(storage);
      primeira.definirLembrar(true);
      primeira.definir(chave());
      primeira.reordenar(['gemini', 'openai', 'anthropic']);
      const nova = criarKeyStore(storage, ['anthropic', 'openai']);
      expect(nova.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
    });

    it('apagar tudo volta à ordem inicial, não à de fábrica', () => {
      const store = criarKeyStore(null, ['anthropic']);
      store.reordenar(['openai', 'gemini', 'anthropic']);
      store.apagarTudo();
      expect(store.ordem()).toEqual(['anthropic', 'gemini', 'openai']);
    });

    it('a ordem inicial pode ser uma função: apagar tudo lê a preferência de agora', () => {
      let preferida: ProviderId[] | undefined = ['anthropic'];
      const store = criarKeyStore(null, () => preferida);
      expect(store.ordem()).toEqual(['anthropic', 'gemini', 'openai']);
      preferida = ['gemini', 'openai'];
      store.apagarTudo();
      expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
      preferida = undefined;
      store.apagarTudo();
      expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
    });
  });
});
