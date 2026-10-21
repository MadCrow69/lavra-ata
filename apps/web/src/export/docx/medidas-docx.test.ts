import { describe, expect, it } from 'vitest';
import { LARGURAS_ENCAMINHAMENTOS } from '../../config/documento';
import { A4_DXA, larguraUtilDxa, largurasDxa, ptParaDxa, ptParaPx } from './medidas-docx';

const soma = (n: readonly number[]) => n.reduce((a, b) => a + b, 0);

describe('medidas do DOCX', () => {
  it('A4 em vinte avos de ponto', () => {
    expect(A4_DXA).toEqual({ largura: 11906, altura: 16838 });
  });

  it('converte pt em dxa (×20) e em px (×96/72)', () => {
    expect(ptParaDxa(56)).toBe(1120);
    expect(ptParaDxa(10.5)).toBe(210);
    expect(ptParaPx(72)).toBe(96);
  });

  it('largura útil = A4 menos as duas margens', () => {
    expect(larguraUtilDxa()).toBe(9666);
  });

  it('larguras em % viram dxa e somam a largura útil', () => {
    const l = largurasDxa([50, 20, 15, 15], 4);
    expect(l).toEqual([4833, 1933, 1450, 1450]);
    expect(soma(l)).toBe(9666);
    expect(largurasDxa(LARGURAS_ENCAMINHAMENTOS, 4)).toEqual(l);
  });

  it('sem larguras, divide igualmente (diferença de no máximo 1)', () => {
    for (const colunas of [1, 2, 3, 4, 5, 7]) {
      const l = largurasDxa(undefined, colunas);
      expect(l).toHaveLength(colunas);
      expect(soma(l)).toBe(9666);
      expect(Math.max(...l) - Math.min(...l)).toBeLessThanOrEqual(1);
    }
  });

  it('larguras que não batem com o número de colunas (ou inválidas) caem na divisão igual', () => {
    expect(largurasDxa([50, 50], 3)).toEqual(largurasDxa(undefined, 3));
    expect(largurasDxa([0, 0], 2)).toEqual(largurasDxa(undefined, 2));
    expect(largurasDxa([Number.NaN, 10], 2)).toEqual(largurasDxa(undefined, 2));
  });

  it('zero colunas não gera larguras', () => {
    expect(largurasDxa(undefined, 0)).toEqual([]);
  });
});
