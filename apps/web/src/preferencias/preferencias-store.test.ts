import { describe, expect, it, vi } from 'vitest';
import { PREFERENCIAS } from '../config/storage-keys';
import { storageFalso } from '../test/storage-falso';
import {
  CAMPOS_PREFERENCIAS,
  criarPreferenciasStore,
  type Preferencias,
} from './preferencias-store';

const gravado = (itens: Map<string, string>): unknown =>
  JSON.parse(itens.get(PREFERENCIAS) ?? 'null');

describe('criarPreferenciasStore', () => {
  it('sem nada gravado: preferências vazias e lembrar() false', () => {
    const s = criarPreferenciasStore(storageFalso().storage, storageFalso().storage);
    expect(s.atual()).toEqual({});
    expect(s.lembrar()).toBe(false);
  });

  it('definir grava na sessão e NÃO no local', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarPreferenciasStore(sessao.storage, local.storage);
    expect(s.definir({ tom: 'conciso' })).toEqual({ persistiu: true });
    expect(s.atual()).toEqual({ tom: 'conciso' });
    expect(gravado(sessao.itens)).toEqual({ versao: 1, tom: 'conciso' });
    expect(local.itens.has(PREFERENCIAS)).toBe(false);
  });

  it('definirLembrar(true) copia o atual para o local; definir depois grava nos dois', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarPreferenciasStore(sessao.storage, local.storage);
    s.definir({ tom: 'conciso', destaque: 'vinho' });
    expect(s.definirLembrar(true)).toEqual({ persistiu: true });
    expect(s.lembrar()).toBe(true);
    expect(gravado(local.itens)).toEqual({ versao: 1, tom: 'conciso', destaque: 'vinho' });

    s.definir({ tipoId: 'cipa' });
    const esperado = { versao: 1, tom: 'conciso', destaque: 'vinho', tipoId: 'cipa' };
    expect(gravado(local.itens)).toEqual(esperado);
    expect(gravado(sessao.itens)).toEqual(esperado);
  });

  it('mescla campo a campo e os modelos por provedor', () => {
    const s = criarPreferenciasStore(storageFalso().storage, storageFalso().storage);
    s.definir({ modelos: { openai: 'gpt-x' } });
    s.definir({ modelos: { gemini: 'gem-y' }, tom: 'detalhado' });
    s.definir({ modelos: { openai: 'gpt-z' } });
    expect(s.atual()).toEqual({
      tom: 'detalhado',
      modelos: { openai: 'gpt-z', gemini: 'gem-y' },
    });
  });

  it('só os campos da lista fechada chegam ao storage (a transcrição nunca)', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarPreferenciasStore(sessao.storage, local.storage);
    s.definirLembrar(true);
    s.definir({
      transcricao: 'segredo',
      participantes: ['Ana'],
      tom: 'formal',
    } as unknown as Preferencias);
    for (const { itens } of [sessao, local]) {
      const texto = itens.get(PREFERENCIAS) ?? '';
      expect(texto).not.toContain('segredo');
      expect(texto).not.toContain('Ana');
      const chaves = Object.keys(gravado(itens) as object);
      for (const chave of chaves) expect(['versao', ...CAMPOS_PREFERENCIAS]).toContain(chave);
    }
    expect(s.atual()).toEqual({ tom: 'formal' });
  });

  it('a lista fechada de campos é exatamente a do contrato', () => {
    expect([...CAMPOS_PREFERENCIAS].sort()).toEqual(
      ['destaque', 'modelos', 'ordem', 'tipoId', 'tom'].sort(),
    );
  });

  it('definir com valor inválido ignora o campo (não grava lixo)', () => {
    const sessao = storageFalso();
    const s = criarPreferenciasStore(sessao.storage, storageFalso().storage);
    s.definir({
      tom: 'gritando',
      destaque: 'rosa',
      tipoId: 'xyz',
      modelos: { openai: '   ', ninguem: 'x' },
    } as unknown as Preferencias);
    expect(s.atual()).toEqual({});
  });

  describe('leitura', () => {
    it('valida cada campo à parte; inválido = campo ausente; ordem é completada', () => {
      const local = storageFalso();
      local.itens.set(
        PREFERENCIAS,
        JSON.stringify({
          versao: 1,
          destaque: 'rosa',
          tipoId: 'xyz',
          tom: 'conciso',
          ordem: ['openai', 'xyz'],
        }),
      );
      const s = criarPreferenciasStore(storageFalso().storage, local.storage);
      expect(s.atual()).toEqual({ tom: 'conciso', ordem: ['openai', 'gemini', 'anthropic'] });
    });

    it('aceita todos os campos válidos; modelos com trim e só provedores conhecidos', () => {
      const local = storageFalso();
      local.itens.set(
        PREFERENCIAS,
        JSON.stringify({
          versao: 1,
          tipoId: 'cipa',
          tom: 'detalhado',
          destaque: 'verde',
          ordem: ['anthropic', 'openai', 'gemini'],
          modelos: { openai: ' gpt-x ', gemini: '', outro: 'y', anthropic: 3 },
        }),
      );
      const s = criarPreferenciasStore(storageFalso().storage, local.storage);
      expect(s.atual()).toEqual({
        tipoId: 'cipa',
        tom: 'detalhado',
        destaque: 'verde',
        ordem: ['anthropic', 'openai', 'gemini'],
        modelos: { openai: 'gpt-x' },
      });
    });

    it.each([
      ['JSON quebrado', '{nao-e-json'],
      ['versão 2', JSON.stringify({ versao: 2, tom: 'conciso' })],
      ['não é objeto', JSON.stringify([1])],
    ])('%s → vazio (e apagado)', (_n, bruto) => {
      const local = storageFalso();
      local.itens.set(PREFERENCIAS, bruto);
      const s = criarPreferenciasStore(storageFalso().storage, local.storage);
      expect(s.atual()).toEqual({});
      expect(s.lembrar()).toBe(false);
      expect(local.itens.has(PREFERENCIAS)).toBe(false);
    });

    it('o local vence a sessão na abertura e lembrar() é true', () => {
      const sessao = storageFalso();
      const local = storageFalso();
      sessao.itens.set(PREFERENCIAS, JSON.stringify({ versao: 1, tom: 'formal' }));
      local.itens.set(PREFERENCIAS, JSON.stringify({ versao: 1, tom: 'detalhado' }));
      const s = criarPreferenciasStore(sessao.storage, local.storage);
      expect(s.atual()).toEqual({ tom: 'detalhado' });
      expect(s.lembrar()).toBe(true);
      expect(gravado(sessao.itens)).toEqual({ versao: 1, tom: 'detalhado' });
    });

    it('a sessão sozinha restaura (recarregar a aba) sem ligar lembrar', () => {
      const sessao = storageFalso();
      criarPreferenciasStore(sessao.storage, storageFalso().storage).definir({ tom: 'conciso' });
      const nova = criarPreferenciasStore(sessao.storage, storageFalso().storage);
      expect(nova.atual()).toEqual({ tom: 'conciso' });
      expect(nova.lembrar()).toBe(false);
    });

    it('getItem que lança → vazio, sem exceção', () => {
      const bloqueado = storageFalso({ recusaLer: true }).storage;
      const s = criarPreferenciasStore(bloqueado, bloqueado);
      expect(s.atual()).toEqual({});
    });
  });

  describe('falha de armazenamento', () => {
    it('setItem que lança no local: definirLembrar(true) → persistiu false, lembrar() false', () => {
      const s = criarPreferenciasStore(
        storageFalso().storage,
        storageFalso({ recusaGravar: true }).storage,
      );
      s.definir({ tom: 'conciso' });
      expect(s.definirLembrar(true)).toEqual({ persistiu: false });
      expect(s.lembrar()).toBe(false);
      expect(s.atual()).toEqual({ tom: 'conciso' });
    });

    it('sem storage nenhum: tudo segue em memória, persistiu false', () => {
      const s = criarPreferenciasStore(null, null);
      expect(s.definir({ tom: 'conciso' })).toEqual({ persistiu: false });
      expect(s.atual()).toEqual({ tom: 'conciso' });
      expect(s.definirLembrar(true)).toEqual({ persistiu: false });
      expect(s.lembrar()).toBe(false);
    });

    it('o local recusa uma gravação depois de ligado: lembrar() desliga e o local é limpo', () => {
      const local = storageFalso();
      const s = criarPreferenciasStore(storageFalso().storage, local.storage);
      s.definirLembrar(true);
      const original = local.storage.setItem.bind(local.storage);
      local.storage.setItem = () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      };
      expect(s.definir({ tom: 'conciso' })).toEqual({ persistiu: false });
      expect(s.lembrar()).toBe(false);
      expect(local.itens.has(PREFERENCIAS)).toBe(false);
      local.storage.setItem = original;
    });
  });

  it('definirLembrar(false) apaga o local e mantém o atual na sessão', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarPreferenciasStore(sessao.storage, local.storage);
    s.definir({ tom: 'conciso' });
    s.definirLembrar(true);
    expect(s.definirLembrar(false)).toEqual({ persistiu: true });
    expect(s.lembrar()).toBe(false);
    expect(local.itens.has(PREFERENCIAS)).toBe(false);
    expect(gravado(sessao.itens)).toEqual({ versao: 1, tom: 'conciso' });
  });

  it('esquecer apaga o local, desliga lembrar e mantém atual() e a sessão', () => {
    const sessao = storageFalso();
    const local = storageFalso();
    const s = criarPreferenciasStore(sessao.storage, local.storage);
    s.definir({ tom: 'conciso' });
    s.definirLembrar(true);
    s.esquecer();
    expect(local.itens.has(PREFERENCIAS)).toBe(false);
    expect(s.lembrar()).toBe(false);
    expect(s.atual()).toEqual({ tom: 'conciso' });
    expect(gravado(sessao.itens)).toEqual({ versao: 1, tom: 'conciso' });
  });

  it('atual() devolve cópia: mexer no resultado não altera o store', () => {
    const s = criarPreferenciasStore(storageFalso().storage, storageFalso().storage);
    s.definir({ ordem: ['openai', 'gemini', 'anthropic'], modelos: { openai: 'a' } });
    const a = s.atual();
    a.ordem?.reverse();
    if (a.modelos) a.modelos.openai = 'mutado';
    expect(s.atual().ordem).toEqual(['openai', 'gemini', 'anthropic']);
    expect(s.atual().modelos).toEqual({ openai: 'a' });
  });

  it('assinar avisa a cada mudança e revisao() cresce; cancelar para os avisos', () => {
    const s = criarPreferenciasStore(storageFalso().storage, storageFalso().storage);
    const ouvinte = vi.fn();
    const cancelar = s.assinar(ouvinte);
    const antes = s.revisao();
    s.definir({ tom: 'conciso' });
    s.definirLembrar(true);
    s.esquecer();
    expect(ouvinte).toHaveBeenCalledTimes(3);
    expect(s.revisao()).toBeGreaterThan(antes);
    cancelar();
    s.definir({ tom: 'formal' });
    expect(ouvinte).toHaveBeenCalledTimes(3);
  });
});
