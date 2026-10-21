import { isValidCpf } from '../check-digits';
import { continuesAsLargerNumber, hasContext } from '../context';
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
    const formatted = FULLY_FORMATTED.test(raw);
    // Seguido de `.50` ou `-3`, o trecho é parte de um número maior, SALVO se for totalmente
    // formatado (inconfundível) ou houver palavra de contexto (`CPF 52998224725-2026`).
    const context = hasContext(text, start, CONTEXT);
    if (!formatted && !context && continuesAsLargerNumber(text, start + raw.length)) {
      return { ok: false, valid: false };
    }
    const valid = isValidCpf(normalizeValue('CPF', raw));
    const spaced = raw.includes(' ');
    // Totalmente formatado: sempre. Demais formas: contexto ou DV válido; com
    // espaços só contexto.
    const ok = formatted || context || (!spaced && valid);
    return { ok, valid };
  },
};
