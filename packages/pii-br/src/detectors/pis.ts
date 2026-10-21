import { isValidPis } from '../check-digits';
import { continuesAsLargerNumber, hasContext, WIDE_WINDOW } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['pis', 'pasep', 'nit', 'nis'] as const;
const FULLY_FORMATTED = /^\d{3}\.\d{5}\.\d{2}-\d$/;

export const pis: Detector = {
  type: 'PIS',
  // 11 dígitos; separador opcional e independente entre os grupos (`.`, `,` ou espaço) e,
  // antes do DV, também ` - ` (formatado 000.00000.00-0, colado, parcial ou misto).
  pattern: /(?<![0-9A-Za-z])\d{3}[ .,]?\d{5}[ .,]?\d{2}(?: ?- ?|[ .,]?)\d(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const formatted = FULLY_FORMATTED.test(raw);
    // Mesma regra do CPF: fora do formato completo e sem contexto, `.50`/`-3` indica número maior.
    const context = hasContext(text, start, CONTEXT, WIDE_WINDOW);
    if (!formatted && !context && continuesAsLargerNumber(text, start + raw.length)) {
      return { ok: false, valid: false };
    }
    const valid = isValidPis(normalizeValue('PIS', raw));
    // Com espaço (inclusive ` - `) só o contexto basta, como no CPF.
    const ok = formatted || (!raw.includes(' ') && valid) || context;
    return { ok, valid };
  },
};
