import { isValidCnpj } from '../check-digits';
import { hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['cnpj'] as const;

export const cnpj: Detector = {
  type: 'CNPJ',
  // Numérico ou alfanumérico (letras aceitas em minúsculas); formatado | colado.
  pattern:
    /(?<![0-9A-Za-z])(?:[0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\/[0-9A-Za-z]{4}-\d{2}|[0-9A-Za-z]{12}\d{2})(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const valid = isValidCnpj(normalizeValue('CNPJ', raw));
    const formatted = raw.includes('/');
    return { ok: formatted || valid || hasContext(text, start, CONTEXT), valid };
  },
};
