// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  abrirFonte,
  calcularCobertura,
  conteudoDaCobertura,
  DESTINO,
  FONTES_EMBUTIDAS,
} from './gerar-cobertura-fontes.mjs';

const semCr = (texto: string) => texto.replaceAll('\r\n', '\n');

const FAMILIAS = ['corpo', 'titulo'] as const;
const SUBSETS = ['latin', 'ext'] as const;

describe('cobertura das fontes do PDF (glifos reais)', () => {
  it('cobertura-gerada.ts está atualizado (regenerado em memória = arquivo)', async () => {
    expect(semCr(readFileSync(DESTINO, 'utf-8'))).toBe(semCr(await conteudoDaCobertura()));
  });

  it('todo ponto das faixas tem glifo (≠ .notdef) em cada arquivo da família/subset', () => {
    const cobertura = calcularCobertura();
    for (const familia of FAMILIAS) {
      for (const subset of SUBSETS) {
        const fontes = FONTES_EMBUTIDAS[familia][subset].map(abrirFonte);
        let pontos = 0;
        for (const [inicio, fim] of cobertura[familia][subset]) {
          for (let ponto = inicio; ponto <= fim; ponto += 1) {
            pontos += 1;
            for (const fonte of fontes) {
              expect(
                fonte.hasGlyphForCodePoint(ponto),
                `${familia}.${subset} U+${ponto.toString(16)}`,
              ).toBe(true);
            }
          }
        }
        // Piso de sanidade: um subset vazio (arquivo errado) não pode passar calado.
        expect(pontos, `${familia}.${subset}`).toBeGreaterThan(150);
      }
    }
  });

  it('ficam de fora os pontos declarados no unicode-range sem glifo (caixinha no PDF)', () => {
    const corpoLatin = calcularCobertura().corpo.latin;
    const coberto = (p: number) => corpoLatin.some(([a, b]) => p >= a && p <= b);
    for (const ponto of [0x00ad, 0x2010, 0x2011, 0x202f, 0x2030])
      expect(coberto(ponto)).toBe(false);
  });

  it('os arquivos medidos são exatamente os que arquivos-fonte.ts embute', () => {
    const fonte = readFileSync(
      join(import.meta.dirname, '../src/export/pdf/arquivos-fonte.ts'),
      'utf-8',
    );
    const embutidos = [...fonte.matchAll(/from '(@fontsource\/[^']+\.woff)\?inline'/g)]
      .map((m) => m[1])
      .sort();
    const medidos = FAMILIAS.flatMap((f) => SUBSETS.flatMap((s) => FONTES_EMBUTIDAS[f][s])).sort();
    expect(embutidos).toEqual(medidos);
  });
});
