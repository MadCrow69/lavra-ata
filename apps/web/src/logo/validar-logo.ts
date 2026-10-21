import {
  LOGO_LADO_MAX_ORIGEM_PX,
  LOGO_LADO_MIN_PX,
  LOGO_PIXELS_MAX_ORIGEM,
  LOGO_SVG_BYTES_CABECALHO,
  LOGO_TAMANHO_MAX_BYTES,
} from '../config/logo';
import type { Dimensoes } from '../document/medidas';

/**
 * Validação da logo pelo CONTEÚDO: formato pela assinatura dos bytes (nunca pela extensão nem pelo
 * MIME declarado, que a pessoa ou o sistema operacional controlam) e dimensões lidas do cabeçalho,
 * antes de qualquer decodificação (defesa contra bomba de descompressão).
 */

export type FormatoLogo = 'png' | 'jpeg' | 'webp' | 'svg';
export type MotivoErroLogo = 'vazio' | 'grande' | 'formato' | 'dimensoes' | 'ilegivel';

const MEGABYTE = 1024 * 1024;

/** 6000 → "6.000" (pt-BR, sem depender do ICU do ambiente). */
function milhares(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const MENSAGEM_ERRO_LOGO: Record<MotivoErroLogo, string> = {
  vazio: 'O arquivo da logo está vazio. Escolha outra imagem.',
  grande: `A logo passa de ${String(LOGO_TAMANHO_MAX_BYTES / MEGABYTE)} MB. Reduza a imagem ou exporte em PNG menor.`,
  formato: 'Formato de logo não aceito. Envie PNG, JPEG, WebP ou SVG.',
  dimensoes: `A logo tem dimensões fora do aceito (de ${String(LOGO_LADO_MIN_PX)} a ${milhares(LOGO_LADO_MAX_ORIGEM_PX)} pixels por lado). Redimensione a imagem.`,
  ilegivel: 'Não foi possível ler esta imagem. Se for SVG, exporte a logo em PNG e envie de novo.',
};

export class ErroDeLogo extends Error {
  readonly motivo: MotivoErroLogo;

  constructor(motivo: MotivoErroLogo) {
    super(MENSAGEM_ERRO_LOGO[motivo]);
    this.name = 'ErroDeLogo';
    this.motivo = motivo;
  }
}

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function comeca(bytes: Uint8Array, assinatura: number[], deslocamento = 0): boolean {
  return (
    bytes.length >= deslocamento + assinatura.length &&
    assinatura.every((b, i) => bytes[deslocamento + i] === b)
  );
}

function ascii(texto: string): number[] {
  return Array.from(texto, (c) => c.charCodeAt(0));
}

/** Pula, no começo do texto, BOM, espaços, `<?xml …?>`, comentários e `<!DOCTYPE …>`. */
function semPrologoXml(texto: string): string | null {
  let resto = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  for (;;) {
    resto = resto.trimStart();
    if (resto.startsWith('<?')) {
      const fim = resto.indexOf('?>');
      if (fim < 0) return null;
      resto = resto.slice(fim + 2);
    } else if (resto.startsWith('<!--')) {
      const fim = resto.indexOf('-->', 4);
      if (fim < 0) return null;
      resto = resto.slice(fim + 3);
    } else if (/^<!DOCTYPE/i.test(resto)) {
      const colchete = resto.indexOf('[');
      const maior = resto.indexOf('>');
      let fim: number;
      if (colchete >= 0 && (maior < 0 || colchete < maior)) {
        const fechaSubconjunto = resto.indexOf(']', colchete);
        fim = fechaSubconjunto < 0 ? -1 : resto.indexOf('>', fechaSubconjunto);
      } else {
        fim = maior;
      }
      if (fim < 0) return null;
      resto = resto.slice(fim + 1);
    } else {
      return resto;
    }
  }
}

/** Texto do documento a partir de `<svg`, ou `null` se os primeiros bytes não começam por ele. */
function textoDoSvg(bytes: Uint8Array): string | null {
  const cabecalho = bytes.subarray(0, LOGO_SVG_BYTES_CABECALHO);
  const resto = semPrologoXml(new TextDecoder('utf-8').decode(cabecalho));
  return resto !== null && /^<svg[\s>]/.test(resto) ? resto : null;
}

/** Formato pela assinatura dos bytes; `null` quando não é um dos aceitos. */
export function detectarFormato(bytes: Uint8Array): FormatoLogo | null {
  if (comeca(bytes, ASSINATURA_PNG)) return 'png';
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (comeca(bytes, ascii('RIFF')) && comeca(bytes, ascii('WEBP'), 8)) return 'webp';
  return textoDoSvg(bytes) !== null ? 'svg' : null;
}

const u16be = (b: Uint8Array, i: number): number => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number): number =>
  (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
const u16le = (b: Uint8Array, i: number): number => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number): number =>
  (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);

function dimensoesPng(bytes: Uint8Array): Dimensoes | null {
  if (bytes.length < 24 || !comeca(bytes, ascii('IHDR'), 12)) return null;
  return { largura: u32be(bytes, 16), altura: u32be(bytes, 20) };
}

/** Marcadores SOF0–SOF15, exceto C4 (DHT), C8 (JPG) e CC (DAC), que não descrevem o quadro. */
const ehQuadroJpeg = (m: number): boolean =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function dimensoesJpeg(bytes: Uint8Array): Dimensoes | null {
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let marcador = bytes[i + 1] ?? 0;
    // Bytes 0xFF de enchimento antes do marcador.
    while (marcador === 0xff && i + 2 < bytes.length) {
      i += 1;
      marcador = bytes[i + 1] ?? 0;
    }
    // Marcadores sem corpo: TEM, RSTn, SOI, EOI.
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd9)) {
      if (marcador === 0xd9) return null;
      i += 2;
      continue;
    }
    const tamanho = u16be(bytes, i + 2);
    if (tamanho < 2) return null;
    if (ehQuadroJpeg(marcador)) {
      if (i + 8 >= bytes.length) return null;
      return { largura: u16be(bytes, i + 7), altura: u16be(bytes, i + 5) };
    }
    i += 2 + tamanho;
  }
  return null;
}

function dimensoesWebp(bytes: Uint8Array): Dimensoes | null {
  if (comeca(bytes, ascii('VP8X'), 12)) {
    if (bytes.length < 30) return null;
    return { largura: u24le(bytes, 24) + 1, altura: u24le(bytes, 27) + 1 };
  }
  if (comeca(bytes, ascii('VP8L'), 12)) {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const bits = (u16le(bytes, 21) | (u16le(bytes, 23) << 16)) >>> 0;
    return { largura: (bits & 0x3fff) + 1, altura: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (comeca(bytes, ascii('VP8 '), 12)) {
    if (bytes.length < 30 || !comeca(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return { largura: u16le(bytes, 26) & 0x3fff, altura: u16le(bytes, 28) & 0x3fff };
  }
  return null;
}

/** Dimensões declaradas no cabeçalho do bitmap, sem decodificá-lo; `null` se ilegível/truncado. */
export function lerDimensoes(
  bytes: Uint8Array,
  formato: Exclude<FormatoLogo, 'svg'>,
): Dimensoes | null {
  if (formato === 'png') return dimensoesPng(bytes);
  if (formato === 'jpeg') return dimensoesJpeg(bytes);
  return dimensoesWebp(bytes);
}

const NUMERO = '(\\d+(?:\\.\\d+)?)';

/** `120`, `120px` → 120; porcentagem, `cm`, `em` etc. → `null` (dependem do contexto). */
function medidaSvg(valor: string | undefined): number | null {
  const achado = valor === undefined ? null : new RegExp(`^\\s*${NUMERO}(?:px)?\\s*$`).exec(valor);
  const n = achado ? Number(achado[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function atributoSvg(atributos: string, nome: string): string | undefined {
  const achado = new RegExp(`(?:^|\\s)${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(atributos);
  return achado ? (achado[1] ?? achado[2]) : undefined;
}

/**
 * Tamanho de um SVG lido só do texto (o SVG nunca é inserido como markup): `width`/`height`
 * numéricos, senão o `viewBox`; `null` quando o arquivo não declara nenhum dos dois. Como o SVG é
 * vetorial, o declarado vale mais que o tamanho que o navegador atribui (um SVG só com `viewBox`
 * de 2400×800 sai do navegador como 300×100).
 */
export function dimensoesDeclaradasSvg(bytes: Uint8Array): Dimensoes | null {
  const texto = textoDoSvg(bytes) ?? '';
  const atributos = /^<svg((?:[^>"']|"[^"]*"|'[^']*')*)>?/.exec(texto)?.[1] ?? '';
  const largura = medidaSvg(atributoSvg(atributos, 'width'));
  const altura = medidaSvg(atributoSvg(atributos, 'height'));
  if (largura !== null && altura !== null) return { largura, altura };

  const viewBox = atributoSvg(atributos, 'viewBox');
  const partes =
    viewBox
      ?.trim()
      .split(/[\s,]+/)
      .map(Number) ?? [];
  const [, , w, h] = partes;
  if (partes.length === 4 && w !== undefined && h !== undefined && w > 0 && h > 0) {
    return { largura: w, altura: h };
  }
  return null;
}

function dimensoesAceitas({ largura, altura }: Dimensoes): boolean {
  return (
    largura >= LOGO_LADO_MIN_PX &&
    altura >= LOGO_LADO_MIN_PX &&
    largura <= LOGO_LADO_MAX_ORIGEM_PX &&
    altura <= LOGO_LADO_MAX_ORIGEM_PX &&
    largura * altura <= LOGO_PIXELS_MAX_ORIGEM
  );
}

/**
 * Valida tamanho, formato e dimensões dos bytes. Lança `ErroDeLogo`. SVG não tem dimensões aqui
 * (são vetoriais; a rasterização desenha direto no tamanho de saída).
 */
export function validarBytesLogo(bytes: Uint8Array): {
  formato: FormatoLogo;
  dimensoes: Dimensoes | null;
} {
  if (bytes.length === 0) throw new ErroDeLogo('vazio');
  if (bytes.length > LOGO_TAMANHO_MAX_BYTES) throw new ErroDeLogo('grande');
  const formato = detectarFormato(bytes);
  if (formato === null) throw new ErroDeLogo('formato');
  if (formato === 'svg') return { formato, dimensoes: null };

  const dimensoes = lerDimensoes(bytes, formato);
  if (dimensoes === null) throw new ErroDeLogo('ilegivel');
  if (!dimensoesAceitas(dimensoes)) throw new ErroDeLogo('dimensoes');
  return { formato, dimensoes };
}
