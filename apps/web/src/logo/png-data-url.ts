/** PNG em data URL: o único formato em que a logo circula depois de rasterizada. */

export const PREFIXO_DATA_URL_PNG = 'data:image/png;base64,';

const CORPO_BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Tamanho aproximado, em bytes, do PNG dentro do data URL (base64 → 3 bytes a cada 4 caracteres). */
export function bytesDoDataUrlPng(dataUrl: string): number {
  return Math.ceil(((dataUrl.length - PREFIXO_DATA_URL_PNG.length) * 3) / 4);
}

/** O texto é um data URL de PNG em base64 (prefixo e alfabeto), sem olhar o tamanho. */
export function ehDataUrlPng(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.startsWith(PREFIXO_DATA_URL_PNG) &&
    CORPO_BASE64.test(valor.slice(PREFIXO_DATA_URL_PNG.length))
  );
}
