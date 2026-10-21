import { hasContext } from '../context';
import type { Detector } from './types';

const CONTEXT = ['rg', 'identidade', 'registro geral'] as const;

export const rg: Detector = {
  type: 'RG',
  // O RG não tem formato nacional único: 5 a 14 caracteres `[0-9Xx.-]`, começando por
  // dígito e terminando em dígito/X (o ponto final da frase não entra). Cobre
  // `12.345.678-X`, `123456789` e variantes estaduais. Só é aceito com contexto.
  pattern: /(?<![0-9A-Za-z])\d[0-9Xx.-]{3,12}[0-9Xx](?![0-9A-Za-z])/g,
  accept(_raw, text, start) {
    return { ok: hasContext(text, start, CONTEXT), valid: true };
  },
};
