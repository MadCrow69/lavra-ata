const DEFAULT_WINDOW = 25;

/** Minúsculas e sem diacríticos ("Cartão" → "cartao"). */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Há alguma das palavras de contexto na janela imediatamente ANTERIOR a `start`?
 * Sem distinção de acento ou caixa. A palavra não pode começar no meio de outra
 * ("nit" não casa em "comunitário").
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
      if (from === 0 || !/\p{L}/u.test(before.charAt(from - 1))) return true;
    }
    return false;
  });
}
