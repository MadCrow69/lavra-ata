// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { abrirFonte, FONTES_EMBUTIDAS } from './gerar-cobertura-fontes.mjs';
import { DESTINO, calcularMetricas, conteudoDasMetricas } from './gerar-metricas-fontes.mjs';

const semCr = (texto: string) => texto.replaceAll('\r\n', '\n');

describe('métricas do Inter para os testes de largura', () => {
  it('metricas-inter.gerada.ts está atualizado (regenerado em memória = arquivo)', async () => {
    expect(semCr(readFileSync(DESTINO, 'utf-8'))).toBe(semCr(await conteudoDasMetricas()));
  });

  it('mede os mesmos arquivos que o PDF embute no corpo (regular e negrito)', () => {
    const [normal, negrito] = FONTES_EMBUTIDAS.corpo.latin.map(abrirFonte);
    const { unidadesPorEm, normal: a, negrito: b } = calcularMetricas();
    expect(unidadesPorEm).toBe(normal?.unitsPerEm);
    expect(a.find(([c]) => c === 'M')?.[1]).toBe(normal?.layout('M').advanceWidth);
    expect(b.find(([c]) => c === 'M')?.[1]).toBe(negrito?.layout('M').advanceWidth);
  });

  it('cobre o latim com acentos e a pontuação dos rótulos, e o negrito é mais largo', () => {
    const { normal, negrito } = calcularMetricas();
    const tem = (pares: [string, number][], c: string) => pares.some(([k]) => k === c);
    for (const c of 'AZaz09 áéíóúâêôãõçÁÉÇ%()/-—º') {
      expect(tem(normal, c), c).toBe(true);
      expect(tem(negrito, c), c).toBe(true);
    }
    const largura = (pares: [string, number][]) => pares.reduce((soma, [, n]) => soma + n, 0);
    expect(largura(negrito)).toBeGreaterThan(largura(normal));
  });
});
