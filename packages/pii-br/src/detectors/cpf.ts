import { isValidCpf } from '../check-digits';
import { hasContext } from '../context';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

const CONTEXT = ['cpf'] as const;
const FULLY_FORMATTED = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

export const cpf: Detector = {
  type: 'CPF',
  // 11 dígitos com pontuação opcional e independente (cobre formatado, colado e
  // parcial como `529982247-25`) | 11 dígitos separados por espaço.
  pattern:
    /(?<![0-9A-Za-z])(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{3} \d{3} \d{3} \d{2})(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    const valid = isValidCpf(normalizeValue('CPF', raw));
    const spaced = raw.includes(' ');
    // Totalmente formatado: sempre. Demais formas: contexto ou DV válido; com
    // espaços só contexto.
    const ok = FULLY_FORMATTED.test(raw) || hasContext(text, start, CONTEXT) || (!spaced && valid);
    return { ok, valid };
  },
};
