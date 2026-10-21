import { isValidLuhn } from '../check-digits';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

export const cartao: Detector = {
  type: 'CARTAO',
  // 13 a 19 dígitos, com espaço ou hífen opcional entre eles.
  pattern: /(?<![0-9A-Za-z])\d(?:[ -]?\d){12,18}(?![0-9A-Za-z])/g,
  accept(raw) {
    const digits = normalizeValue('CARTAO', raw);
    // Luhn é exigido SEMPRE (contexto não o dispensa). Luhn aceita sequências
    // degeneradas (ex.: só zeros), então dígitos todos iguais são rejeitados.
    const ok = isValidLuhn(digits) && !/^(\d)\1*$/.test(digits);
    return { ok, valid: ok };
  },
};
