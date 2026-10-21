import { isValidLuhn } from '../check-digits';
import { normalizeValue } from '../normalize';
import type { Detector } from './types';

// Um ou dois espaços (transcrição costuma duplicar), ou um hífen com espaço opcional de
// cada lado (`4111 - 1111`).
const S = String.raw`(?: ?- ?| {1,2})`;

/**
 * Agrupamentos reais de cartão (tamanhos dos grupos) e o número colado (13 a 19 dígitos).
 * Depois da forma, UM grupo anexo opcional de 3 a 4 dígitos, ligado por um separador (CVV ou
 * grupo extra), entra no trecho mascarado: senão vazaria ao lado do marcador. Grupo de
 * 2 dígitos (validade `12 28`) e ano separado por palavra (`... em 2026`) não são anexados.
 * Consequência: um ano colado logo depois do cartão (`4111 1111 1111 1111 2026`) é engolido.
 */
const CARD_FORMS = [
  [4, 4, 4, 4], // 16
  [4, 6, 5], // 15 (Amex)
  [4, 6, 4], // 14 (Diners)
  [4, 4, 4, 1], // 13 (Visa antigo)
]
  .map((sizes) => sizes.map((size) => String.raw`\d{${String(size)}}`).join(S))
  .concat(String.raw`\d{13,19}`) // colado
  .join('|');

const BODY = String.raw`(?<card>${CARD_FORMS})(?:${S}(?<extra>\d{3,4}))?`;
const PARTS = new RegExp(`^${BODY}$`);

/** Único tamanho total em que o conjunto cartão + anexo pode ser um cartão (4-4-4-4-3). */
const COMBINED_LENGTH = 19;

const luhnOk = (digits: string): boolean => isValidLuhn(digits) && !/^(\d)\1*$/.test(digits);

export const cartao: Detector = {
  type: 'CARTAO',
  pattern: new RegExp(String.raw`(?<![0-9A-Za-z])${BODY}(?![0-9A-Za-z])`, 'g'),
  accept(raw) {
    // Invariante: todo trecho entregue pelo `pattern` casa com `PARTS` (mesmo corpo). Se não
    // casar, rejeita (fail-closed): nunca avalia um valor cuja estrutura não foi confirmada.
    const card = PARTS.exec(raw)?.groups?.card;
    if (card === undefined) return { ok: false, valid: false };
    const cardDigits = normalizeValue('CARTAO', card);
    const whole = normalizeValue('CARTAO', raw);
    // Luhn é exigido SEMPRE (contexto não o dispensa). Luhn aceita sequências
    // degeneradas (ex.: só zeros), então dígitos todos iguais são rejeitados. O conjunto
    // cartão + anexo só vale como cartão de 19 dígitos (4-4-4-4-3 ou 16 colados + 3); em
    // qualquer outro tamanho (17, 18, 20) o anexo é CVV e só o cartão é conferido.
    const ok =
      luhnOk(cardDigits) ||
      (whole !== cardDigits && whole.length === COMBINED_LENGTH && luhnOk(whole));
    return { ok, valid: ok };
  },
};
