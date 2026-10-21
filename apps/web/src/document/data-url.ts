const DATA_URL_BASE64 = /^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/;

/** Parte base64 de uma data URL; lança `TypeError` se não for data URL em base64. */
export function base64DeDataUrl(url: string): string {
  const achado = DATA_URL_BASE64.exec(url);
  if (achado?.[1] === undefined) {
    throw new TypeError('Esperava uma data URL em base64.');
  }
  return achado[1];
}

/** Bytes de uma data URL em base64, decodificados localmente (sem `fetch`). */
export function bytesDeDataUrl(url: string): Uint8Array {
  const binario = atob(base64DeDataUrl(url));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
