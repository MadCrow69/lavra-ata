// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATA_TYPES } from '../../ata-types/registry';
import type { AtaTypeDefinition } from '../../ata-types/types';
import { TIPO_DE_TESTE } from '../../test/tipo-de-teste';

/**
 * Guarda dos cartões da lista de participantes (`form.module.css`): a lista vira cartões pela
 * largura do próprio bloco (`@container lista-participantes`), com um limiar por quantidade de
 * colunas de dados (`data-colunas`). Uma quantidade sem bloco nunca viraria cartão e voltaria a
 * rolar na horizontal dentro do bloco.
 */

const CSS = readFileSync(new URL('./form.module.css', import.meta.url), 'utf8');

/** Largura mínima da tabela (rem): N × (campo de 8rem + 1rem de respiro) + ação + folga. */
const limiarRem = (colunas: number) => colunas * 9 + 4;

/** `data-colunas` → limiar (rem) de cada bloco `@container lista-participantes (width < Xrem)`. */
function blocosDoCss(): Map<number, number> {
  const blocos = new Map<number, number>();
  const padrao =
    /@container lista-participantes \(width < ([\d.]+)rem\) \{\s*\.tabela\[data-colunas='(\d+)'\]/g;
  for (const [, limiar, colunas] of CSS.matchAll(padrao)) {
    const n = Number(colunas);
    expect(blocos.has(n), `bloco repetido para ${String(n)} colunas`).toBe(false);
    blocos.set(n, Number(limiar));
  }
  return blocos;
}

/**
 * Quantidades de colunas de dados que o tipo pode mostrar: nome e presença sempre; papel se o tipo
 * o tem; extras sem `visivelSe` sempre e os condicionais em qualquer combinação.
 */
function quantidadesPossiveis(tipo: AtaTypeDefinition): number[] {
  const fixas = 2 + (tipo.rotuloPapel === null ? 0 : 1);
  const sempre = tipo.camposParticipante.filter((c) => c.visivelSe === undefined).length;
  const condicionais = tipo.camposParticipante.length - sempre;
  return Array.from({ length: condicionais + 1 }, (_, i) => fixas + sempre + i);
}

describe('cartões da lista de participantes por largura do bloco', () => {
  const blocos = blocosDoCss();

  it('há blocos no CSS (piso de sanidade do padrão lido)', () => {
    expect(blocos.size).toBeGreaterThanOrEqual(3);
  });

  it.each([...Object.values(ATA_TYPES), TIPO_DE_TESTE].map((t) => [t.id, t] as const))(
    '%s: toda quantidade de colunas possível tem bloco',
    (_id, tipo) => {
      for (const n of quantidadesPossiveis(tipo)) {
        expect(blocos.has(n), `${tipo.id}: falta o bloco de ${String(n)} colunas`).toBe(true);
      }
    },
  );

  it('o limiar de cada bloco segue a largura mínima da tabela (N × 9rem + 4rem)', () => {
    for (const [n, limiar] of blocos) expect(limiar, `${String(n)} colunas`).toBe(limiarRem(n));
  });
});
