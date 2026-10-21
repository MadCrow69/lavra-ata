import { hasContext } from '../context';
import type { Detector } from './types';

const CONTEXT = ['cep'] as const;

export const cep: Detector = {
  type: 'CEP',
  // `01.310-100` | `01310-100` | `01310100` (este só com contexto). Bordas também
  // barram "dígito + . ou -" antes/depois, para não pegar pedaço de telefone ou CPF.
  pattern: /(?<![0-9A-Za-z]|\d[.-])(?:\d{2}\.\d{3}-\d{3}|\d{5}-\d{3}|\d{8})(?![0-9A-Za-z]|[.-]\d)/g,
  accept(raw, text, start) {
    return { ok: /\D/.test(raw) || hasContext(text, start, CONTEXT), valid: true };
  },
};
