import { isValidPis } from '../check-digits';
import { hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['pis', 'pasep', 'nit', 'nis'] as const;

export const pis: Detector = {
  type: 'PIS',
  // formatado (000.00000.00-0) | 11 dígitos colados
  pattern: /(?<![0-9A-Za-z])(?:\d{3}\.\d{5}\.\d{2}-\d|\d{11})(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const valid = isValidPis(normalizeValue('PIS', raw));
    const formatted = raw.includes('.');
    return { ok: formatted || valid || hasContext(text, start, CONTEXT), valid };
  },
};
