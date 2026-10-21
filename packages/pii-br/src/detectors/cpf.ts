import { isValidCpf } from '../check-digits';
import { hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['cpf'] as const;

export const cpf: Detector = {
  type: 'CPF',
  // formatado | 11 dígitos colados | 11 dígitos separados por espaço
  pattern:
    /(?<![0-9A-Za-z])(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{3} \d{3} \d{3} \d{2})(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const valid = isValidCpf(normalizeValue('CPF', raw));
    const formatted = raw.includes('-');
    const spaced = raw.includes(' ');
    // Com espaços só vale com contexto; colado vale com DV válido ou contexto.
    const ok = formatted || hasContext(text, start, CONTEXT) || (!spaced && valid);
    return { ok, valid };
  },
};
