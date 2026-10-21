export interface Trecho {
  start: number;
  /** Posição final (exclusiva). */
  end: number;
}

export interface Parte {
  /** Posição inicial no texto fatiado; serve de chave estável na renderização. */
  inicio: number;
  texto: string;
  destaque: boolean;
}

/**
 * Fatia o texto em partes comuns e destacadas, em ordem. Os trechos devem vir em ordem de
 * posição e sem sobreposição (é como `detect` e `findMarkers` os devolvem); a renderização usa
 * nós de texto e `<mark>`, nunca HTML.
 */
export function fatiar(texto: string, trechos: readonly Trecho[]): Parte[] {
  const partes: Parte[] = [];
  let cursor = 0;
  for (const { start, end } of trechos) {
    if (start < cursor || end <= start) continue;
    if (start > cursor)
      partes.push({ inicio: cursor, texto: texto.slice(cursor, start), destaque: false });
    partes.push({ inicio: start, texto: texto.slice(start, end), destaque: true });
    cursor = end;
  }
  if (cursor < texto.length)
    partes.push({ inicio: cursor, texto: texto.slice(cursor), destaque: false });
  return partes;
}
