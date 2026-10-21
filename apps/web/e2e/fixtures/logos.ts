import { crc32, deflateSync } from 'node:zlib';

/** Arquivos de logo dos E2E: um PNG de verdade e os casos hostis da lista do Review Focus. */

export interface ArquivoDeLogo {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  return Buffer.concat([u32(dados.length), corpo, u32(crc32(corpo))]);
}

function cabecalhoPng(largura: number, altura: number): Buffer {
  return chunk('IHDR', Buffer.concat([u32(largura), u32(altura), Buffer.from([8, 2, 0, 0, 0])]));
}

/** PNG RGB decodificável de `largura`×`altura`, de uma cor só. */
export function pngValido(largura = 240, altura = 80, [r, g, b] = [30, 90, 160]): Buffer {
  const linha = Buffer.alloc(1 + largura * 3);
  for (let x = 0; x < largura; x++) linha.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: altura }, () => linha));
  return Buffer.concat([
    ASSINATURA_PNG,
    cabecalhoPng(largura, altura),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const LOGO_PNG: ArquivoDeLogo = {
  name: 'logo.png',
  mimeType: 'image/png',
  buffer: pngValido(),
};

/**
 * SVG que tenta de tudo: `<script>`, `onload` e uma imagem externa. Rasterizado como `<img>`, o
 * navegador não executa script nem busca o recurso externo; se algo disso acontecesse, o
 * `window.__svgExecutou` apareceria ou a rede/CSP acusaria.
 */
export const LOGO_SVG_HOSTIL: ArquivoDeLogo = {
  name: 'logo.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="80" onload="window.__svgExecutou = true">
  <script>window.__svgExecutou = true</script>
  <rect width="240" height="80" fill="#8a2b2b"/>
  <image href="https://example.com/rastreador.png" width="10" height="10"/>
  <image xlink:href="https://example.com/rastreador2.png" width="10" height="10"/>
</svg>`,
    'utf8',
  ),
};

/** GIF com nome e tipo de PNG: a validação olha os bytes, não o nome. */
export const LOGO_GIF_DISFARCADO: ArquivoDeLogo = {
  name: 'logo.png',
  mimeType: 'image/png',
  buffer: Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'),
};

/** PNG de poucos bytes que declara 20000×20000 (bomba de descompressão): recusado antes de decodificar. */
export const LOGO_PNG_GIGANTE: ArquivoDeLogo = {
  name: 'logo.png',
  mimeType: 'image/png',
  buffer: Buffer.concat([
    ASSINATURA_PNG,
    cabecalhoPng(20_000, 20_000),
    chunk('IEND', Buffer.alloc(0)),
  ]),
};

/** Arquivo de 2 MB + 1 byte (PNG só no começo): recusado pelo tamanho. */
export const LOGO_GRANDE_DEMAIS: ArquivoDeLogo = {
  name: 'logo.png',
  mimeType: 'image/png',
  buffer: Buffer.concat([
    pngValido(16, 16),
    Buffer.alloc(2 * 1024 * 1024 + 1 - pngValido(16, 16).length),
  ]),
};
