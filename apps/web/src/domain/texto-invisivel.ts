/**
 * Caracteres que não desenham nada nem mudam o que a pessoa lê: formatação invisível (`\p{Cf}`:
 * hífen suave U+00AD, largura zero U+200B–U+200D, marcas de direção U+200E–U+200F, U+2060–U+2069,
 * BOM U+FEFF…) e seletores de variação (U+FE00–U+FE0F). Definição única: o agrupamento das
 * tarefas e o texto do PDF removem exatamente o mesmo conjunto.
 */
const INVISIVEIS = /[\p{Cf}\u{FE00}-\u{FE0F}]/gu;

/** Texto sem os caracteres invisíveis. */
export function semInvisiveis(texto: string): string {
  return texto.replace(INVISIVEIS, '');
}
