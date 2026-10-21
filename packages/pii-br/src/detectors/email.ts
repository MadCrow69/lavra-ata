import type { Detector } from './types';

// Limites do RFC 5321 (local <= 64, rótulo <= 63): além de realistas, mantêm o custo da
// varredura linear em texto patológico (`-----…` não vira O(n²)).
// Unicode (`u`): `josé@exemplo.com` e domínios internacionalizados (`x@ação.com`).
const WORD = String.raw`\p{L}\p{N}\p{M}`;

export const email: Detector = {
  type: 'EMAIL',
  // Pragmático: `local@dominio.tld`. Local com `.`, `_`, `%`, `+` (plus-addressing) e `-`;
  // domínio com subdomínios. Sem lookahead no fim: o TLD é guloso e o ponto final de
  // uma frase (`...com.br.`) não entra, pois todo rótulo exige um caractere depois do ponto.
  pattern: new RegExp(
    String.raw`(?<![${WORD}])[${WORD}._%+-]{1,64}@(?:[${WORD}-]{1,63}\.){1,30}\p{L}{2,63}`,
    'gu',
  ),
  accept() {
    return { ok: true, valid: true };
  },
};
