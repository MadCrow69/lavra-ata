import { describe, expect, it } from 'vitest';
import { fatiar, mesclarTrechos } from './fatiar';

describe('fatiar', () => {
  it('partes comuns e destacadas em ordem, com o trecho de origem', () => {
    const t = { start: 4, end: 7, rotulo: 'x' };
    expect(fatiar('abc def ghi', [t])).toEqual([
      { inicio: 0, texto: 'abc ', destaque: false, trecho: null },
      { inicio: 4, texto: 'def', destaque: true, trecho: t },
      { inicio: 7, texto: ' ghi', destaque: false, trecho: null },
    ]);
  });

  it('ignora trecho fora de ordem ou vazio', () => {
    const partes = fatiar('abcdef', [
      { start: 2, end: 4 },
      { start: 1, end: 3 },
      { start: 5, end: 5 },
    ]);
    expect(partes.map((p) => p.texto)).toEqual(['ab', 'cd', 'ef']);
  });
});

describe('mesclarTrechos', () => {
  const p = (start: number, end: number) => ({ start, end, tipo: 'pii' as const });
  const s = (start: number, end: number) => ({ start, end, categoria: 'saude' });

  it('intercala por posição', () => {
    expect(mesclarTrechos([p(10, 12)], [s(0, 3), s(20, 25)])).toEqual([
      s(0, 3),
      p(10, 12),
      s(20, 25),
    ]);
  });

  it('na sobreposição, o prioritário vence (qualquer interseção derruba o secundário)', () => {
    expect(mesclarTrechos([p(5, 10)], [s(3, 6), s(7, 8), s(9, 12), s(10, 11)])).toEqual([
      p(5, 10),
      s(10, 11),
    ]);
  });

  it('listas vazias', () => {
    expect(mesclarTrechos([], [s(1, 2)])).toEqual([s(1, 2)]);
    expect(mesclarTrechos([p(1, 2)], [])).toEqual([p(1, 2)]);
  });
});
