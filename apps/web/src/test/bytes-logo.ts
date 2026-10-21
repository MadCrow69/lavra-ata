/** Monta, nos testes, os bytes mínimos de cada formato de imagem (só o que o leitor de cabeçalho lê). */

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16be = (n: number) => [(n >>> 8) & 255, n & 255];
const u16le = (n: number) => [n & 255, (n >>> 8) & 255];
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function bytesPng(largura: number, altura: number): Uint8Array {
  return Uint8Array.from([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...u32be(13),
    ...ascii('IHDR'),
    ...u32be(largura),
    ...u32be(altura),
    ...[8, 6, 0, 0, 0],
    ...[0, 0, 0, 0],
  ]);
}

export function bytesJpeg(
  largura: number,
  altura: number,
  opcoes: { app1?: boolean } = {},
): Uint8Array {
  const app1 = opcoes.app1 ? [0xff, 0xe1, ...u16be(10), ...ascii('Exif'), 0, 0, 0, 0] : [];
  const sof0 = [
    ...[0xff, 0xc0],
    ...u16be(17),
    8,
    ...u16be(altura),
    ...u16be(largura),
    ...[3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  ];
  return Uint8Array.from([0xff, 0xd8, ...app1, ...sof0, 0xff, 0xd9]);
}

export function bytesWebpVp8x(largura: number, altura: number): Uint8Array {
  return Uint8Array.from([
    ...ascii('RIFF'),
    ...[26, 0, 0, 0],
    ...ascii('WEBP'),
    ...ascii('VP8X'),
    ...[10, 0, 0, 0],
    ...[0, 0, 0, 0],
    ...u24le(largura - 1),
    ...u24le(altura - 1),
  ]);
}

export function bytesWebpVp8(largura: number, altura: number): Uint8Array {
  return Uint8Array.from([
    ...ascii('RIFF'),
    ...[30, 0, 0, 0],
    ...ascii('WEBP'),
    ...ascii('VP8 '),
    ...[10, 0, 0, 0],
    ...[0, 0, 0, 0x9d, 0x01, 0x2a],
    ...u16le(largura),
    ...u16le(altura),
  ]);
}

export function bytesWebpVp8l(largura: number, altura: number): Uint8Array {
  const bits = ((largura - 1) & 0x3fff) | (((altura - 1) & 0x3fff) << 14);
  return Uint8Array.from([
    ...ascii('RIFF'),
    ...[30, 0, 0, 0],
    ...ascii('WEBP'),
    ...ascii('VP8L'),
    ...[5, 0, 0, 0],
    0x2f,
    bits & 255,
    (bits >>> 8) & 255,
    (bits >>> 16) & 255,
    (bits >>> 24) & 255,
  ]);
}

export function bytesTexto(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

export function bytesGif(): Uint8Array {
  return Uint8Array.from([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0]);
}
