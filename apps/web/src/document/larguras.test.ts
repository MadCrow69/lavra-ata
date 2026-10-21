import { describe, expect, it } from 'vitest';
import { largurasPorPeso } from './larguras';

const soma = (l: number[]) => l.reduce((a, b) => a + b, 0);

describe('largurasPorPeso', () => {
  it('reparte 100 pelo maior resto', () => {
    expect(largurasPorPeso([3, 2, 2])).toEqual([43, 29, 28]);
  });

  it('empate no resto vai para o menor índice', () => {
    expect(largurasPorPeso([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('pesos fracionários: inteiros que somam 100', () => {
    const l = largurasPorPeso([3, 1.5, 2, 1.5, 2]);
    expect(l).toEqual([30, 15, 20, 15, 20]);
    expect(soma(l)).toBe(100);
  });

  it('sempre inteiros ≥ 1 somando 100, mesmo com pesos muito desiguais', () => {
    for (const pesos of [
      [1],
      [1, 1],
      [1000, 1],
      [1, 1000, 1],
      [0.01, 5, 0.01, 7.3],
      [2, 3, 5, 7, 11, 13],
    ]) {
      const l = largurasPorPeso(pesos);
      expect(l, String(pesos)).toHaveLength(pesos.length);
      expect(soma(l), String(pesos)).toBe(100);
      expect(
        l.every((n) => Number.isInteger(n) && n >= 1),
        String(pesos),
      ).toBe(true);
    }
  });

  it('é monotônica: peso maior nunca recebe largura menor', () => {
    const l = largurasPorPeso([5, 3, 1.5]);
    expect(l[0]).toBeGreaterThanOrEqual(l[1] ?? 0);
    expect(l[1]).toBeGreaterThanOrEqual(l[2] ?? 0);
  });

  it('sem colunas, devolve lista vazia; peso inválido lança', () => {
    expect(largurasPorPeso([])).toEqual([]);
    expect(() => largurasPorPeso([1, 0])).toThrow();
    expect(() => largurasPorPeso([1, Number.NaN])).toThrow();
    expect(() => largurasPorPeso([-1, 2])).toThrow();
  });

  it('mais de 100 colunas não cabem em inteiros ≥ 1 e lançam', () => {
    expect(() => largurasPorPeso(Array.from({ length: 101 }, () => 1))).toThrow();
  });
});
