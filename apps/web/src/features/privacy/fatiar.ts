export interface Trecho {
  start: number;
  /** Posição final (exclusiva). */
  end: number;
}

export interface Parte<T extends Trecho = Trecho> {
  /** Posição inicial no texto fatiado; serve de chave estável na renderização. */
  inicio: number;
  texto: string;
  destaque: boolean;
  /** O trecho que gerou o destaque (para escolher o estilo); `null` na parte comum. */
  trecho: T | null;
}

/**
 * Fatia o texto em partes comuns e destacadas, em ordem. Os trechos devem vir em ordem de
 * posição e sem sobreposição (é como `detect` e `findMarkers` os devolvem); a renderização usa
 * nós de texto e `<mark>`, nunca HTML.
 */
export function fatiar<T extends Trecho>(texto: string, trechos: readonly T[]): Parte<T>[] {
  const partes: Parte<T>[] = [];
  let cursor = 0;
  for (const trecho of trechos) {
    const { start, end } = trecho;
    if (start < cursor || end <= start) continue;
    if (start > cursor)
      partes.push({
        inicio: cursor,
        texto: texto.slice(cursor, start),
        destaque: false,
        trecho: null,
      });
    partes.push({ inicio: start, texto: texto.slice(start, end), destaque: true, trecho });
    cursor = end;
  }
  if (cursor < texto.length)
    partes.push({ inicio: cursor, texto: texto.slice(cursor), destaque: false, trecho: null });
  return partes;
}

/**
 * Junta duas listas ordenadas e sem sobreposição interna numa só, ordenada e sem sobreposição:
 * numa sobreposição vence `prioritarios` (o dado pessoal que vira marcador vence o aviso de termo
 * sensível). Linear nas duas listas.
 */
export function mesclarTrechos<A extends Trecho, B extends Trecho>(
  prioritarios: readonly A[],
  secundarios: readonly B[],
): (A | B)[] {
  const mantidos: B[] = [];
  let i = 0;
  for (const s of secundarios) {
    while (i < prioritarios.length && (prioritarios[i]?.end ?? 0) <= s.start) i++;
    const p = prioritarios[i];
    if (p === undefined || p.start >= s.end) mantidos.push(s);
  }
  return [...prioritarios, ...mantidos].sort((a, b) => a.start - b.start);
}
