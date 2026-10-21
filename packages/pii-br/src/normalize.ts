import type { PiiType } from './types';

const onlyDigits = (raw: string): string => raw.replace(/\D/g, '');

/** Forma canônica de um valor, usada como chave de deduplicação (`TIPO:valor`). */
export function normalizeValue(type: PiiType, raw: string): string {
  switch (type) {
    case 'CPF':
    case 'PIS':
    case 'CARTAO':
    case 'CEP':
      return onlyDigits(raw);
    case 'CNPJ':
      return raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
    case 'EMAIL':
      return raw.toLowerCase();
    case 'TELEFONE': {
      const digits = onlyDigits(raw);
      // Remove o código do país (55) apenas quando o total é 12 ou 13 dígitos.
      return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
    }
    case 'PLACA':
      return raw.toUpperCase().replace(/[-\s]/g, '');
    case 'RG':
      return raw.toUpperCase().replace(/[^0-9X]/g, '');
  }
}
