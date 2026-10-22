// Tipos mínimos do fontkit (sem @types publicado) para os geradores de cobertura e de métricas das
// fontes do PDF.
declare module 'fontkit' {
  export interface Font {
    /** Pontos de código mapeados pelo cmap da fonte. */
    characterSet: number[];
    /** `true` se o cmap leva o ponto de código a um glifo diferente do .notdef (glifo 0). */
    hasGlyphForCodePoint(codePoint: number): boolean;
    /** Unidades do desenho da fonte por em (1000 ou 2048, conforme a fonte). */
    unitsPerEm: number;
    /** Compõe o texto com a fonte (cmap, kerning, ligaduras); a largura vem em unidades da fonte. */
    layout(texto: string): { advanceWidth: number };
  }

  /** Abre um arquivo de fonte (TTF/OTF/WOFF/WOFF2). As fontes do Lavra não são coleções. */
  export function openSync(filename: string): Font;
}
