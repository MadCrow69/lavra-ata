const DEFAULT_WINDOW = 25;

/**
 * Janela ampla (RG e PIS): o rótulo costuma vir antes de um nome completo ("O RG da Maria
 * Aparecida dos Santos Oliveira é 12.345.678-9"). Os demais detectores ficam em 25.
 */
export const WIDE_WINDOW = 60;

/** Minúsculas e sem diacríticos ("Cartão" → "cartao"). */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Letra de verdade: `º` e `ª` (indicadores ordinais, "nºCPF") contam como separador. */
function isLetter(char: string): boolean {
  return /\p{L}/u.test(char) && char !== 'º' && char !== 'ª';
}

/**
 * Há alguma das palavras de contexto na janela imediatamente ANTERIOR a `start`?
 * Sem distinção de acento ou caixa. A palavra precisa estar isolada por não-letras nos
 * dois lados: "nit" não casa em "comunitário" nem em "nitidez"; "nis" não casa em "nisso".
 * Plural não é aceito (sem "s" final): o número vem logo depois do rótulo, não de uma lista.
 */
export function hasContext(
  text: string,
  start: number,
  words: readonly string[],
  window: number = DEFAULT_WINDOW,
): boolean {
  const before = fold(text.slice(Math.max(0, start - window), start));
  return words.some((word) => {
    const needle = fold(word);
    for (let from = before.indexOf(needle); from !== -1; from = before.indexOf(needle, from + 1)) {
      const after = from + needle.length;
      const leftOk = from === 0 || !isLetter(before.charAt(from - 1));
      const rightOk = after >= before.length || !isLetter(before.charAt(after));
      if (leftOk && rightOk) return true;
    }
    return false;
  });
}

/**
 * O trecho que termina em `end` continua como número maior (`.` ou `-` seguido de dígito)?
 * `12345678901.50` e `52998224725-3` são valor/código, não um CPF ou PIS seguido de resto;
 * já o ponto final de uma frase (`...-25.`) não conta.
 */
export function continuesAsLargerNumber(text: string, end: number): boolean {
  return /^[.-]\d/.test(text.slice(end, end + 2));
}
