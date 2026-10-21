import { isValidCnpj } from '../check-digits';
import { hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['cnpj'] as const;
const FULLY_FORMATTED = /^[0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\/[0-9A-Za-z]{4}-\d{2}$/;

export const cnpj: Detector = {
  type: 'CNPJ',
  // Numérico ou alfanumérico (letras aceitas em minúsculas). Cada pontuação (`.`, `.`, `/`,
  // `-`) é opcional e independente: cobre formatado, colado e parcial (`11222333/0001-81`).
  pattern:
    /(?<![0-9A-Za-z])[0-9A-Za-z]{2}\.?[0-9A-Za-z]{3}\.?[0-9A-Za-z]{3}\/?[0-9A-Za-z]{4}-?\d{2}(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const valid = isValidCnpj(normalizeValue('CNPJ', raw));
    // Só o totalmente formatado dispensa DV e contexto; o parcial/colado exige um dos dois.
    const formatted = FULLY_FORMATTED.test(raw);
    return { ok: formatted || valid || hasContext(text, start, CONTEXT), valid };
  },
};
