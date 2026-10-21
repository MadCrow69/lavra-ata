import { hasContext, WIDE_WINDOW } from '../context';
import type { Detector } from './types';

const CONTEXT = ['rg', 'identidade', 'registro geral'] as const;

// UF do órgão emissor colada ou separada do número (`MG12345678`, `SP 12.345.678-9`).
// Só UFs reais: `de 12345` ("identidade de 12345") não pode virar prefixo.
const UF = 'AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';
// Agrupado `12.345.678-9`, `12 345 678`, `12.345.678 - 9` (espaços em volta do traço).
const GROUPED = String.raw`\d{1,2}[. ]\d{3}[. ]\d{3}(?: ?[-\u2013\u2010] ?[0-9Xx])?(?![0-9A-Za-z]|[.\-]\d)`;
// Corrido: 5 a 14 caracteres `[0-9Xx.-]`, começando por dígito e terminando em dígito/X
// (o ponto final da frase não entra).
const RUN = String.raw`\d[0-9Xx.\-]{3,12}[0-9Xx]`;

export const rg: Detector = {
  type: 'RG',
  // O RG não tem formato nacional único. Só é aceito com contexto (antes do número).
  pattern: new RegExp(
    String.raw`(?<![0-9A-Za-z])(?:(?:${UF})[- ]?)?(?:${GROUPED}|${RUN})(?![0-9A-Za-z])`,
    'gi',
  ),
  accept(_raw, text, start) {
    return { ok: hasContext(text, start, CONTEXT, WIDE_WINDOW), valid: true };
  },
};
