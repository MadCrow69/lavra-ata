import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageOuNulo } from './storage-ou-nulo';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storageOuNulo', () => {
  it('devolve o storage pedido', () => {
    expect(storageOuNulo('local')).toBe(localStorage);
    expect(storageOuNulo('session')).toBe(sessionStorage);
  });

  it('acesso que lança (modo privado, política) vira null só para aquele storage', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    expect(storageOuNulo('local')).toBeNull();
    expect(storageOuNulo('session')).toBe(sessionStorage);
  });
});
