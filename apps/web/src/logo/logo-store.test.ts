import { describe, expect, it } from 'vitest';
import { LOGO_BYTES_MAX_PNG, LOGO_SAIDA_MAX_PX } from '../config/logo';
import { LOGO } from '../config/storage-keys';
import type { LogoDoc } from '../document/model';
import { criarLogoStore } from './logo-store';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const logo = (parcial: Partial<LogoDoc> = {}): LogoDoc => ({
  dataUrl: PNG,
  largura: 300,
  altura: 100,
  ...parcial,
});
const gravado = (parcial: Partial<LogoDoc> = {}, versao = 1): string =>
  JSON.stringify({ versao, ...logo(parcial) });

/** Storage em memória que pode ser configurado para recusar gravações (cota cheia). */
function storageFalso(opcoes: { recusaGravar?: boolean } = {}) {
  const itens = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return itens.size;
    },
    clear: () => {
      itens.clear();
    },
    getItem: (k) => itens.get(k) ?? null,
    key: (i) => [...itens.keys()][i] ?? null,
    removeItem: (k) => {
      itens.delete(k);
    },
    setItem: (k, v) => {
      if (opcoes.recusaGravar) throw new DOMException('cheio', 'QuotaExceededError');
      itens.set(k, v);
    },
  };
  return { storage, itens };
}

describe('criarLogoStore', () => {
  it('começa sem logo e sem lembrar', () => {
    const s = criarLogoStore(storageFalso().storage, storageFalso().storage);
    expect(s.atual()).toBeNull();
    expect(s.lembrar()).toBe(false);
  });

  it('sem lembrar, grava só na sessão', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarLogoStore(sessao.storage, local.storage);
    expect(s.definir(logo())).toEqual({ persistiu: true });
    expect(s.atual()).toEqual(logo());
    expect(JSON.parse(sessao.itens.get(LOGO) ?? 'null')).toEqual({ versao: 1, ...logo() });
    expect(local.itens.has(LOGO)).toBe(false);
  });

  it('com lembrar, grava no local; uma store nova restaura a logo e lembrar() === true', () => {
    const local = storageFalso();
    const s = criarLogoStore(storageFalso().storage, local.storage);
    s.definir(logo());
    expect(s.definirLembrar(true)).toEqual({ persistiu: true });
    expect(s.lembrar()).toBe(true);
    expect(local.itens.has(LOGO)).toBe(true);

    // Outra aba: sessão vazia, local preenchido.
    const nova = criarLogoStore(storageFalso().storage, local.storage);
    expect(nova.atual()).toEqual(logo());
    expect(nova.lembrar()).toBe(true);
  });

  it('com lembrar ligado, uma logo nova também vai para o local', () => {
    const local = storageFalso();
    const s = criarLogoStore(storageFalso().storage, local.storage);
    s.definir(logo());
    s.definirLembrar(true);
    s.definir(logo({ largura: 150, altura: 50 }));
    expect(JSON.parse(local.itens.get(LOGO) ?? 'null')).toMatchObject({ largura: 150 });
  });

  it('desmarcar lembrar apaga do local e mantém a logo na sessão e na memória', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarLogoStore(sessao.storage, local.storage);
    s.definir(logo());
    s.definirLembrar(true);
    expect(s.definirLembrar(false)).toEqual({ persistiu: true });
    expect(s.lembrar()).toBe(false);
    expect(local.itens.has(LOGO)).toBe(false);
    expect(sessao.itens.has(LOGO)).toBe(true);
    expect(s.atual()).toEqual(logo());
  });

  it('lembrar sem logo não grava nada e continua desligado', () => {
    const local = storageFalso();
    const s = criarLogoStore(storageFalso().storage, local.storage);
    expect(s.definirLembrar(true)).toEqual({ persistiu: true });
    expect(s.lembrar()).toBe(false);
    expect(local.itens.size).toBe(0);
  });

  it('remover limpa a memória e os dois storages', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarLogoStore(sessao.storage, local.storage);
    s.definir(logo());
    s.definirLembrar(true);
    s.remover();
    expect(s.atual()).toBeNull();
    expect(s.lembrar()).toBe(false);
    expect(sessao.itens.has(LOGO)).toBe(false);
    expect(local.itens.has(LOGO)).toBe(false);
  });

  it('a sessão restaura a logo depois de recarregar (store nova, mesmo sessionStorage)', () => {
    const sessao = storageFalso();
    criarLogoStore(sessao.storage, storageFalso().storage).definir(logo());
    const nova = criarLogoStore(sessao.storage, storageFalso().storage);
    expect(nova.atual()).toEqual(logo());
    expect(nova.lembrar()).toBe(false);
  });

  it('o local vale mais que a sessão quando os dois têm logo', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    sessao.itens.set(LOGO, gravado({ largura: 10, altura: 10 }));
    local.itens.set(LOGO, gravado({ largura: 20, altura: 20 }));
    const s = criarLogoStore(sessao.storage, local.storage);
    expect(s.atual()).toMatchObject({ largura: 20 });
    expect(s.lembrar()).toBe(true);
  });

  it('o local espelha na sessão ao restaurar: a sessão não guarda mais uma logo mais velha', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    sessao.itens.set(LOGO, gravado({ largura: 10, altura: 10 }));
    local.itens.set(LOGO, gravado({ largura: 20, altura: 20 }));
    criarLogoStore(sessao.storage, local.storage);
    expect(JSON.parse(sessao.itens.get(LOGO) ?? 'null')).toMatchObject({ largura: 20 });
  });

  it('duas abas: desmarcar "Lembrar" e recarregar não traz de volta a logo velha da sessão', () => {
    // Aba B ficou com a logo velha na sessão; a aba A trocou a logo e lembrou (local = nova).
    const sessaoB = storageFalso();
    const local = storageFalso();
    sessaoB.itens.set(LOGO, gravado({ largura: 10, altura: 10 }));
    local.itens.set(LOGO, gravado({ largura: 20, altura: 20 }));

    const aba = criarLogoStore(sessaoB.storage, local.storage);
    expect(aba.atual()).toMatchObject({ largura: 20 });
    aba.definirLembrar(false);
    expect(local.itens.has(LOGO)).toBe(false);

    const recarregada = criarLogoStore(sessaoB.storage, local.storage);
    expect(recarregada.atual()).toMatchObject({ largura: 20 });
    expect(recarregada.lembrar()).toBe(false);
  });

  it('desmarcar lembrar grava a logo atual na sessão, mesmo sem o espelho do restaurar', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarLogoStore(sessao.storage, local.storage);
    s.definir(logo({ largura: 10, altura: 10 }));
    s.definirLembrar(true);
    sessao.itens.set(LOGO, gravado({ largura: 99, altura: 99 }));
    s.definirLembrar(false);
    expect(JSON.parse(sessao.itens.get(LOGO) ?? 'null')).toMatchObject({ largura: 10 });
  });

  describe('valor gravado inválido é ignorado e apagado', () => {
    const corpoGrande = 'A'.repeat(Math.ceil((LOGO_BYTES_MAX_PNG * 4) / 3) + 8);
    const invalidos: [string, string][] = [
      ['JSON quebrado', '{nao-e-json'],
      ['dataUrl de SVG', gravado({ dataUrl: 'data:image/svg+xml,<svg/>' })],
      ['dataUrl javascript:', gravado({ dataUrl: 'javascript:alert(1)' })],
      ['dataUrl PNG com lixo no corpo', gravado({ dataUrl: 'data:image/png;base64,"><x>' })],
      ['dataUrl JPEG', gravado({ dataUrl: 'data:image/jpeg;base64,AAAA' })],
      ['dimensão não inteira', gravado({ largura: 10.5 })],
      ['dimensão zero', gravado({ altura: 0 })],
      ['largura acima da caixa', gravado({ largura: LOGO_SAIDA_MAX_PX.largura + 1 })],
      ['altura acima da caixa', gravado({ altura: LOGO_SAIDA_MAX_PX.altura + 1 })],
      ['versão desconhecida', gravado({}, 2)],
      [
        'PNG acima do limite de bytes',
        gravado({ dataUrl: `data:image/png;base64,${corpoGrande}` }),
      ],
      ['não é objeto', JSON.stringify([1, 2])],
    ];

    it.each(invalidos)('%s', (_nome, bruto) => {
      for (const onde of ['sessao', 'local'] as const) {
        const sessao = storageFalso();
        const local = storageFalso();
        (onde === 'sessao' ? sessao : local).itens.set(LOGO, bruto);
        const s = criarLogoStore(sessao.storage, local.storage);
        expect(s.atual()).toBeNull();
        expect(s.lembrar()).toBe(false);
        expect(sessao.itens.has(LOGO)).toBe(false);
        expect(local.itens.has(LOGO)).toBe(false);
      }
    });

    it('local inválido não impede a logo válida da sessão', () => {
      const sessao = storageFalso();
      const local = storageFalso();
      local.itens.set(LOGO, '{quebrado');
      sessao.itens.set(LOGO, gravado());
      const s = criarLogoStore(sessao.storage, local.storage);
      expect(s.atual()).toEqual(logo());
      expect(s.lembrar()).toBe(false);
      expect(local.itens.has(LOGO)).toBe(false);
    });
  });

  describe('falha de armazenamento', () => {
    it('setItem que lança na sessão: persistiu false e a logo segue em memória', () => {
      const s = criarLogoStore(
        storageFalso({ recusaGravar: true }).storage,
        storageFalso().storage,
      );
      expect(s.definir(logo())).toEqual({ persistiu: false });
      expect(s.atual()).toEqual(logo());
    });

    it('sem storage nenhum (null): persistiu false e a logo segue em memória', () => {
      const s = criarLogoStore(null, null);
      expect(s.definir(logo())).toEqual({ persistiu: false });
      expect(s.atual()).toEqual(logo());
      expect(s.definirLembrar(true)).toEqual({ persistiu: false });
      expect(s.lembrar()).toBe(false);
    });

    it('lembrar recusado pelo local: persistiu false, lembrar() false, logo mantida', () => {
      const s = criarLogoStore(
        storageFalso().storage,
        storageFalso({ recusaGravar: true }).storage,
      );
      s.definir(logo());
      expect(s.definirLembrar(true)).toEqual({ persistiu: false });
      expect(s.lembrar()).toBe(false);
      expect(s.atual()).toEqual(logo());
    });

    it('acesso bloqueado na leitura e na remoção: começa vazio sem quebrar', () => {
      const bloqueado = {
        getItem: () => {
          throw new DOMException('bloqueado', 'SecurityError');
        },
        removeItem: () => {
          throw new DOMException('bloqueado', 'SecurityError');
        },
      } as unknown as Storage;
      const s = criarLogoStore(bloqueado, bloqueado);
      expect(s.atual()).toBeNull();
      expect(() => {
        s.remover();
      }).not.toThrow();
    });
  });

  it('sem argumentos usa o sessionStorage e o localStorage do navegador', () => {
    criarLogoStore().definir(logo());
    expect(sessionStorage.getItem(LOGO)).not.toBeNull();
    expect(localStorage.getItem(LOGO)).toBeNull();
    expect(criarLogoStore().atual()).toEqual(logo());
  });
});
