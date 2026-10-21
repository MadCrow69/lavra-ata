import { isValidLuhn } from '../check-digits';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

// Um ou dois espaços (transcrição costuma duplicar), ou um hífen com espaço opcional de
// cada lado (`4111 - 1111`).
const S = String.raw`(?: ?- ?| {1,2})`;

/**
 * Agrupamentos reais de cartão (tamanhos dos grupos). Cada forma aceita, logo depois, UM
 * grupo anexo de 3 a 4 dígitos ligado por um separador (CVV ou grupo extra): ele
 * entra no trecho mascarado, senão vazaria ao lado do marcador. Grupo de 2 dígitos
 * (validade `12 28`) e ano separado por palavra (`... em 2026`) não são anexados.
 */
const GROUPED_FORMS: readonly (readonly number[])[] = [
  [4, 4, 4, 4], // 16
  [4, 6, 5], // 15 (Amex)
  [4, 6, 4], // 14 (Diners)
];
/** 13 dígitos (Visa antigo): sem grupo anexo, o último grupo de 1 dígito não o permite. */
const VISA_13 = [4, 4, 4, 1] as const;

const group = (sizes: readonly number[]): string =>
  sizes.map((size) => String.raw`\d{${String(size)}}`).join(S);

const CARD_FORMS = [
  ...GROUPED_FORMS.map((sizes) => String.raw`${group(sizes)}(?:${S}\d{3,4})?`),
  group(VISA_13),
  String.raw`\d{13,19}`, // colado
].join('|');

const SEPARATOR = new RegExp(S);

/** Dígitos do cartão dentro do trecho: descarta o grupo anexo (CVV) quando houver um. */
function cardDigits(raw: string): string {
  const groups = raw.split(SEPARATOR);
  const sizes = groups.map((part) => part.length);
  const base = GROUPED_FORMS.find(
    (form) =>
      groups.length === form.length + 1 && form.every((size, index) => sizes[index] === size),
  );
  return normalizeValue('CARTAO', base ? groups.slice(0, base.length).join('') : raw);
}

export const cartao: Detector = {
  type: 'CARTAO',
  pattern: new RegExp(String.raw`(?<![0-9A-Za-z])(?:${CARD_FORMS})(?![0-9A-Za-z])`, 'g'),
  accept(raw) {
    const whole = normalizeValue('CARTAO', raw);
    const card = cardDigits(raw);
    // Luhn é exigido SEMPRE (contexto não o dispensa). Luhn aceita sequências
    // degeneradas (ex.: só zeros), então dígitos todos iguais são rejeitados. Um 4-4-4-4-3
    // (19 dígitos) é cartão de 19 dígitos quando o conjunto fecha no Luhn, ou 16 + CVV quando
    // só os 16 primeiros fecham.
    const ok = [card, whole].some((digits) => isValidLuhn(digits) && !/^(\d)\1*$/.test(digits));
    return { ok, valid: ok };
  },
};
