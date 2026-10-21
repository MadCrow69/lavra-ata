import type { Detector } from './types';

export const email: Detector = {
  type: 'EMAIL',
  // Pragmático: `local@dominio.tld`. Local com `.`, `_`, `%`, `+` (plus-addressing) e `-`;
  // domínio com subdomínios. Sem lookahead no fim: o TLD é guloso e o ponto final de
  // uma frase (`...com.br.`) não entra, pois todo rótulo exige um caractere depois do ponto.
  pattern: /(?<![0-9A-Za-z])[0-9A-Za-z._%+-]+@(?:[0-9A-Za-z-]+\.)+[A-Za-z]{2,}/g,
  accept() {
    return { ok: true, valid: true };
  },
};
