import { describe, expect, it } from 'vitest';
import { encaixar } from './medidas';

const CAIXA = { largura: 1200, altura: 400 };

describe('encaixar', () => {
  it('reduz mantendo a proporção até caber na caixa', () => {
    expect(encaixar({ largura: 3000, altura: 1000 }, CAIXA)).toEqual({
      largura: 1200,
      altura: 400,
    });
    expect(encaixar({ largura: 400, altura: 800 }, CAIXA)).toEqual({ largura: 200, altura: 400 });
  });

  it('nunca amplia', () => {
    expect(encaixar({ largura: 100, altura: 50 }, CAIXA)).toEqual({ largura: 100, altura: 50 });
  });

  it('com `ampliar`, preenche a caixa mantendo a proporção', () => {
    expect(encaixar({ largura: 24, altura: 24 }, CAIXA, { ampliar: true })).toEqual({
      largura: 400,
      altura: 400,
    });
    expect(encaixar({ largura: 1, altura: 1 }, CAIXA, { ampliar: true })).toEqual({
      largura: 400,
      altura: 400,
    });
    expect(encaixar({ largura: 300, altura: 150 }, CAIXA, { ampliar: true })).toEqual({
      largura: 800,
      altura: 400,
    });
  });

  it('recusa medida não finita, zero ou negativa', () => {
    for (const ruim of [Infinity, NaN, 0, -5]) {
      expect(() => encaixar({ largura: ruim, altura: 10 }, CAIXA)).toThrow(RangeError);
      expect(() => encaixar({ largura: 10, altura: ruim }, CAIXA, { ampliar: true })).toThrow(
        RangeError,
      );
    }
  });

  it('nunca devolve lado menor que 1', () => {
    expect(encaixar({ largura: 5000, altura: 1 }, CAIXA)).toEqual({ largura: 1200, altura: 1 });
  });
});
