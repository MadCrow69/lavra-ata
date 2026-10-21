const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PIS_WEIGHTS = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function allSameChar(value: string): boolean {
  return value.split('').every((char) => char === value[0]);
}

/** Soma ponderada dos valores com os pesos dados (um peso por posição). */
function weightedSum(values: number[], weights: number[]): number {
  return weights.reduce((sum, weight, index) => sum + weight * (values[index] ?? 0), 0);
}

function toDigits(value: string): number[] {
  return value.split('').map((char) => char.charCodeAt(0) - 48);
}

/** CPF: 11 dígitos, sem máscara. */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || allSameChar(digits)) return false;
  const values = toDigits(digits);
  const checkDigit = (length: number): number => {
    const weights = Array.from({ length }, (_, index) => length + 1 - index);
    const remainder = (weightedSum(values, weights) * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return checkDigit(9) === values[9] && checkDigit(10) === values[10];
}

/** CNPJ: 14 posições [0-9A-Z], sem máscara, já em maiúsculas (inclui o formato alfanumérico). */
export function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || allSameChar(value)) return false;
  const values = toDigits(value); // valor do caractere = código ASCII - 48
  const checkDigit = (weights: number[]): number => {
    const remainder = weightedSum(values, weights) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checkDigit(CNPJ_WEIGHTS_1) === values[12] && checkDigit(CNPJ_WEIGHTS_2) === values[13];
}

/** PIS/PASEP/NIT: 11 dígitos. */
export function isValidPis(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  const values = toDigits(digits);
  const checkDigit = 11 - (weightedSum(values, PIS_WEIGHTS) % 11);
  return (checkDigit >= 10 ? 0 : checkDigit) === values[10];
}

/** Algoritmo de Luhn para números de cartão: 13 a 19 dígitos. */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  const sum = toDigits(digits)
    .reverse()
    .reduce((acc, digit, index) => {
      if (index % 2 === 0) return acc + digit;
      const doubled = digit * 2;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }, 0);
  return sum % 10 === 0;
}
