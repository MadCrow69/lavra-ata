import { isValidCpf } from '../check-digits';
import { continuesAsLargerNumber, hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['cpf'] as const;
const FULLY_FORMATTED = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

export const cpf: Detector = {
  type: 'CPF',
  // 11 dígitos; entre os grupos, um separador opcional e independente (`.`, `,` ou espaço) e,
  // antes do DV, também ` - ` (cobre formatado, colado, parcial como `529982247-25` e
  // misto como `529.982.247 - 25`). Cada separador é de no máximo um caractere (sem ReDoS).
  pattern: /(?<![0-9A-Za-z])\d{3}[ .,]?\d{3}[ .,]?\d{3}(?: ?- ?|[ .,]?)\d{2}(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const formatted = FULLY_FORMATTED.test(raw);
    // Seguido de `.50` ou `-3`, o trecho é parte de um número maior, SALVO se for totalmente
    // formatado (inconfundível) ou houver palavra de contexto (`CPF 52998224725-2026`).
    const context = hasContext(text, start, CONTEXT);
    if (!formatted && !context && continuesAsLargerNumber(text, start + raw.length)) {
      return { ok: false, valid: false };
    }
    const valid = isValidCpf(normalizeValue('CPF', raw));
    const spaced = raw.includes(' ');
    // Totalmente formatado: sempre. Demais formas: contexto ou DV válido; com espaços
    // (inclusive ` - `) só contexto.
    const ok = formatted || context || (!spaced && valid);
    return { ok, valid };
  },
};
