import { isValidPis } from '../check-digits';
import { continuesAsLargerNumber, hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['pis', 'pasep', 'nit', 'nis'] as const;
const FULLY_FORMATTED = /^\d{3}\.\d{5}\.\d{2}-\d$/;

export const pis: Detector = {
  type: 'PIS',
  // 11 dígitos com pontuação opcional e independente (formatado 000.00000.00-0,
  // colado ou parcial).
  pattern: /(?<![0-9A-Za-z])\d{3}\.?\d{5}\.?\d{2}-?\d(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const formatted = FULLY_FORMATTED.test(raw);
    // Mesma regra do CPF: fora do formato completo e sem contexto, `.50`/`-3` indica número maior.
    const context = hasContext(text, start, CONTEXT);
    if (!formatted && !context && continuesAsLargerNumber(text, start + raw.length)) {
      return { ok: false, valid: false };
    }
    const valid = isValidPis(normalizeValue('PIS', raw));
    const ok = formatted || valid || context;
    return { ok, valid };
  },
};
