import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '../../..');
// Lido como texto: o tsconfig.node (composite) não inclui src/, então importar o JSON daria TS6307.
const caminhos = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../src/config/caminhos-codigo.json'), 'utf-8'),
) as Record<string, string>;

describe('caminhos-codigo.json', () => {
  const entradas = Object.entries(caminhos);

  it('tem ao menos 3 entradas (piso de sanidade: o teste não passa por varrer nada)', () => {
    expect(entradas.length).toBeGreaterThanOrEqual(3);
  });

  it.each(entradas)('"%s" existe na raiz do repositório: %s', (_chave, caminho) => {
    expect(existsSync(resolve(RAIZ, caminho))).toBe(true);
  });
});
