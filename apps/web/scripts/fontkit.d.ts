// Tipos mínimos do fontkit (sem @types publicado) para o gerador de cobertura das fontes do PDF.
declare module 'fontkit' {
  export interface Font {
    /** Pontos de código mapeados pelo cmap da fonte. */
    characterSet: number[];
    /** `true` se o cmap leva o ponto de código a um glifo diferente do .notdef (glifo 0). */
    hasGlyphForCodePoint(codePoint: number): boolean;
  }

  /** Abre um arquivo de fonte (TTF/OTF/WOFF/WOFF2). As fontes do Lavra não são coleções. */
  export function openSync(filename: string): Font;
}
