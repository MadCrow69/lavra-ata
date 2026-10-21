import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(import.meta.dirname, '../src/styles/tokens.css'), 'utf-8').replaceAll(
  '\r\n',
  '\n',
);

/** Declarações `--token: valor` do primeiro bloco que começa com o seletor dado. */
function declaracoes(seletor: string): Map<string, string> {
  const inicio = CSS.indexOf(`\n${seletor} {`);
  expect(inicio, `bloco ${seletor}`).toBeGreaterThan(-1);
  const fim = CSS.indexOf('\n}', inicio);
  const mapa = new Map<string, string>();
  for (const m of CSS.slice(inicio, fim).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    mapa.set(m[1] ?? '', (m[2] ?? '').trim());
  }
  return mapa;
}

describe('tokens: a folha é papel branco nos dois temas', () => {
  const claro = declaracoes(':root');
  const folha = declaracoes('[data-folha]');
  const interativos = [
    '--cor-primaria',
    '--cor-primaria-hover',
    '--cor-sobre-primaria',
    '--cor-superficie',
    '--cor-texto',
    '--cor-borda-forte',
    '--cor-erro',
    '--cor-erro-texto',
    '--cor-foco',
  ];

  it.each(interativos)('%s dentro da folha tem o valor do tema claro', (token) => {
    expect(claro.get(token)).toBeDefined();
    expect(folha.get(token)).toBe(claro.get(token));
  });
});
