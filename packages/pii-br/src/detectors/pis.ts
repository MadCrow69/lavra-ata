import { isValidPis } from '../check-digits';
import { hasContext } from '../context';
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
    const valid = isValidPis(normalizeValue('PIS', raw));
    const ok = FULLY_FORMATTED.test(raw) || valid || hasContext(text, start, CONTEXT);
    return { ok, valid };
  },
};
