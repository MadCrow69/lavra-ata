import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXEMPLO } from '../config/storage-keys';
import { storageFalso } from '../test/storage-falso';
import { gravarExemploNaSessao, lerExemploDaSessao } from './sessao';

afterEach(() => {
  // Primeiro: um getter de sessionStorage espionado faria o clear() abaixo lançar.
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe('marca do modo exemplo na sessão', () => {
  it('grava, lê e apaga', () => {
    expect(lerExemploDaSessao()).toBeNull();
    gravarExemploNaSessao('cipa');
    expect(JSON.parse(sessionStorage.getItem(EXEMPLO) ?? '')).toEqual({
      versao: 1,
      tipoId: 'cipa',
    });
    expect(lerExemploDaSessao()).toBe('cipa');
    gravarExemploNaSessao(null);
    expect(sessionStorage.getItem(EXEMPLO)).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
  });

  it('nunca vai para o localStorage', () => {
    gravarExemploNaSessao('condominio');
    expect(localStorage.length).toBe(0);
  });

  it('sessionStorage que lança ao ler ou gravar → null, sem exceção', () => {
    vi.stubGlobal('sessionStorage', storageFalso({ recusaLer: true, recusaGravar: true }).storage);
    expect(() => {
      gravarExemploNaSessao('cipa');
    }).not.toThrow();
    expect(() => {
      gravarExemploNaSessao(null);
    }).not.toThrow();
    expect(lerExemploDaSessao()).toBeNull();
  });

  it('sessionStorage inacessível (acesso à propriedade lança) → null, sem exceção', () => {
    vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    expect(() => {
      gravarExemploNaSessao('cipa');
    }).not.toThrow();
    expect(lerExemploDaSessao()).toBeNull();
  });

  it.each([
    ['versão diferente', JSON.stringify({ versao: 2, tipoId: 'cipa' })],
    ['JSON quebrado', '{versao: 1'],
    ['tipoId que não é texto', JSON.stringify({ versao: 1, tipoId: 7 })],
    ['tipoId vazio', JSON.stringify({ versao: 1, tipoId: '' })],
    ['não é objeto', JSON.stringify(['cipa'])],
    ['null', 'null'],
  ])('%s → null', (_caso, bruto) => {
    sessionStorage.setItem(EXEMPLO, bruto);
    expect(lerExemploDaSessao()).toBeNull();
  });
});
