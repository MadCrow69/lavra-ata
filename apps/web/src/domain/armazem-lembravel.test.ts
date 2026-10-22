import { describe, expect, it } from 'vitest';
import { storageFalso } from '../test/storage-falso';
import { criarArmazemLembravel } from './armazem-lembravel';

const CHAVE = 'lavra:teste:v1';

interface Valor {
  n: number;
}

/** Validador falso: só aceita `{"n": <inteiro positivo>}`; qualquer outra coisa é inválida. */
function ler(bruto: string): Valor | null {
  try {
    const dado: unknown = JSON.parse(bruto);
    if (typeof dado !== 'object' || dado === null) return null;
    const { n } = dado as { n?: unknown };
    return typeof n === 'number' && Number.isInteger(n) && n > 0 ? { n } : null;
  } catch {
    return null;
  }
}
const serializar = (v: Valor): string => JSON.stringify(v);

const bloqueado = {
  getItem: () => {
    throw new DOMException('bloqueado', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('bloqueado', 'SecurityError');
  },
  removeItem: () => {
    throw new DOMException('bloqueado', 'SecurityError');
  },
} as unknown as Storage;

function criar(sessao: Storage | null, local: Storage | null) {
  return criarArmazemLembravel(CHAVE, ler, serializar, sessao, local);
}

describe('criarArmazemLembravel', () => {
  it('sem nada gravado: lido null e lembrado false', () => {
    const a = criar(storageFalso().storage, storageFalso().storage);
    expect(a.lido).toBeNull();
    expect(a.lembrado).toBe(false);
  });

  it('gravarSessao escreve só na sessão; gravarLocal só no local', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const a = criar(sessao.storage, local.storage);
    expect(a.gravarSessao({ n: 1 })).toBe(true);
    expect(sessao.itens.get(CHAVE)).toBe('{"n":1}');
    expect(local.itens.has(CHAVE)).toBe(false);
    expect(a.gravarLocal({ n: 2 })).toBe(true);
    expect(local.itens.get(CHAVE)).toBe('{"n":2}');
  });

  it('apagarSessao e apagarLocal removem cada um o seu', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const a = criar(sessao.storage, local.storage);
    a.gravarSessao({ n: 1 });
    a.gravarLocal({ n: 1 });
    a.apagarSessao();
    expect(sessao.itens.has(CHAVE)).toBe(false);
    expect(local.itens.has(CHAVE)).toBe(true);
    a.apagarLocal();
    expect(local.itens.has(CHAVE)).toBe(false);
  });

  it('restaura da sessão (lembrado false) e do local (lembrado true)', () => {
    const sessao = storageFalso();
    sessao.itens.set(CHAVE, '{"n":3}');
    const daSessao = criar(sessao.storage, storageFalso().storage);
    expect(daSessao.lido).toEqual({ n: 3 });
    expect(daSessao.lembrado).toBe(false);

    const local = storageFalso();
    local.itens.set(CHAVE, '{"n":4}');
    const doLocal = criar(storageFalso().storage, local.storage);
    expect(doLocal.lido).toEqual({ n: 4 });
    expect(doLocal.lembrado).toBe(true);
  });

  it('o local vence a sessão e é espelhado nela', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    sessao.itens.set(CHAVE, '{"n":1}');
    local.itens.set(CHAVE, '{"n":2}');
    const a = criar(sessao.storage, local.storage);
    expect(a.lido).toEqual({ n: 2 });
    expect(a.lembrado).toBe(true);
    expect(sessao.itens.get(CHAVE)).toBe('{"n":2}');
  });

  describe('valor inválido é ignorado e apagado', () => {
    it.each([['{quebrado'], ['{"n":0}'], ['{"n":1.5}'], ['[1]'], ['"texto"']])('%s', (bruto) => {
      for (const onde of ['sessao', 'local'] as const) {
        const sessao = storageFalso();
        const local = storageFalso();
        (onde === 'sessao' ? sessao : local).itens.set(CHAVE, bruto);
        const a = criar(sessao.storage, local.storage);
        expect(a.lido).toBeNull();
        expect(a.lembrado).toBe(false);
        expect(sessao.itens.has(CHAVE)).toBe(false);
        expect(local.itens.has(CHAVE)).toBe(false);
      }
    });

    it('local inválido não impede o válido da sessão', () => {
      const sessao = storageFalso();
      const local = storageFalso();
      local.itens.set(CHAVE, '{quebrado');
      sessao.itens.set(CHAVE, '{"n":5}');
      const a = criar(sessao.storage, local.storage);
      expect(a.lido).toEqual({ n: 5 });
      expect(a.lembrado).toBe(false);
      expect(local.itens.has(CHAVE)).toBe(false);
    });
  });

  describe('falha de armazenamento nunca lança', () => {
    it('setItem recusado: gravarSessao e gravarLocal devolvem false', () => {
      const a = criar(
        storageFalso({ recusaGravar: true }).storage,
        storageFalso({ recusaGravar: true }).storage,
      );
      expect(a.gravarSessao({ n: 1 })).toBe(false);
      expect(a.gravarLocal({ n: 1 })).toBe(false);
    });

    it('sem storage (null): gravar devolve false e apagar não faz nada', () => {
      const a = criar(null, null);
      expect(a.lido).toBeNull();
      expect(a.gravarSessao({ n: 1 })).toBe(false);
      expect(a.gravarLocal({ n: 1 })).toBe(false);
      expect(() => {
        a.apagarSessao();
        a.apagarLocal();
      }).not.toThrow();
    });

    it('getItem, setItem e removeItem que lançam: começa vazio, sem exceção', () => {
      const a = criar(bloqueado, bloqueado);
      expect(a.lido).toBeNull();
      expect(a.lembrado).toBe(false);
      expect(a.gravarSessao({ n: 1 })).toBe(false);
      expect(() => {
        a.apagarSessao();
        a.apagarLocal();
      }).not.toThrow();
    });

    it('serializar que lança vira false (não escapa)', () => {
      const a = criarArmazemLembravel<Valor>(
        CHAVE,
        ler,
        () => {
          throw new Error('x');
        },
        storageFalso().storage,
        storageFalso().storage,
      );
      expect(a.gravarSessao({ n: 1 })).toBe(false);
    });
  });

  it('sem storages explícitos usa o do navegador', () => {
    sessionStorage.clear();
    localStorage.clear();
    const a = criarArmazemLembravel(CHAVE, ler, serializar);
    a.gravarSessao({ n: 7 });
    expect(sessionStorage.getItem(CHAVE)).toBe('{"n":7}');
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(criarArmazemLembravel(CHAVE, ler, serializar).lido).toEqual({ n: 7 });
    sessionStorage.clear();
  });
});
