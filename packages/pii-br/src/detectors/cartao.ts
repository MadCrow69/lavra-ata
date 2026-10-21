import { isValidLuhn } from '../check-digits';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

// Um espaço, ou um hífen com espaço opcional de cada lado (`4111 - 1111`).
const S = String.raw`(?: ?- ?| )`;

/**
 * Agrupamentos reais de cartão, com separador (espaço ou hífen), ou
 * 13 a 19 dígitos colados. Não há "dígito solto" opcional: um número grande demais
 * (ex.: cartão + validade/CVV separados por espaço) não vira um casamento único
 * que falha no Luhn e deixa o cartão vazar. A ordem importa — 4-4-4-4 vem antes
 * de qualquer forma mais longa, então `4111 1111 1111 1111 123` (cartão + CVV)
 * casa só os 16 dígitos. Consequência assumida: cartão de 19 dígitos agrupado
 * 4-4-4-4-3 não é distinguível de 16 + CVV; só o formato colado cobre 19.
 */
const CARD_FORMS = [
  String.raw`\d{4}${S}\d{4}${S}\d{4}${S}\d{4}`, // 4-4-4-4 (16)
  String.raw`\d{4}${S}\d{6}${S}\d{5}`, // 4-6-5 (15, Amex)
  String.raw`\d{4}${S}\d{6}${S}\d{4}`, // 4-6-4 (14, Diners)
  String.raw`\d{13,19}`, // colado
].join('|');

export const cartao: Detector = {
  type: 'CARTAO',
  pattern: new RegExp(String.raw`(?<![0-9A-Za-z])(?:${CARD_FORMS})(?![0-9A-Za-z])`, 'g'),
  accept(raw) {
    const digits = normalizeValue('CARTAO', raw);
    // Luhn é exigido SEMPRE (contexto não o dispensa). Luhn aceita sequências
    // degeneradas (ex.: só zeros), então dígitos todos iguais são rejeitados.
    const ok = isValidLuhn(digits) && !/^(\d)\1*$/.test(digits);
    return { ok, valid: ok };
  },
};
