import { describe, expect, it } from 'vitest';
import { encaixar, logoNoDocumentoPx } from './medidas';

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

describe('logoNoDocumentoPx', () => {
  // Caixa da logo: LOGO_CAIXA_PT (180×48 pt) = 240×64 px a 96 px/polegada.
  it('reduz a logo grande até caber na caixa, mantendo a proporção', () => {
    expect(logoNoDocumentoPx({ largura: 1200, altura: 400 })).toEqual({
      largura: 192,
      altura: 64,
    });
    expect(logoNoDocumentoPx({ largura: 2400, altura: 200 })).toEqual({
      largura: 240,
      altura: 20,
    });
  });

  it('nunca amplia a logo pequena (mesmo comportamento no PDF e no DOCX)', () => {
    expect(logoNoDocumentoPx({ largura: 16, altura: 16 })).toEqual({ largura: 16, altura: 16 });
    expect(logoNoDocumentoPx({ largura: 1, altura: 1 })).toEqual({ largura: 1, altura: 1 });
  });
});
