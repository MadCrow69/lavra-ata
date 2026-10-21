import { LOGO_CAIXA_PT, PT_POR_POLEGADA, PX_POR_POLEGADA } from '../config/documento';

export interface Dimensoes {
  largura: number;
  altura: number;
}

const medidaValida = (n: number): boolean => Number.isFinite(n) && n > 0;

/**
 * Maior retângulo com a proporção de `origem` que cabe em `caixa`. Por padrão nunca amplia
 * (bitmap); com `ampliar` preenche a caixa (imagem vetorial). Arredonda para inteiro e nunca
 * devolve lado menor que 1. Lança `RangeError` se alguma medida não for finita e positiva.
 */
export function encaixar(
  origem: Dimensoes,
  caixa: Dimensoes,
  opcoes: { ampliar?: boolean } = {},
): Dimensoes {
  if (![origem.largura, origem.altura, caixa.largura, caixa.altura].every(medidaValida)) {
    throw new RangeError('medidas inválidas');
  }
  const escala = Math.min(
    caixa.largura / origem.largura,
    caixa.altura / origem.altura,
    opcoes.ampliar === true ? Infinity : 1,
  );
  return {
    largura: Math.max(1, Math.round(origem.largura * escala)),
    altura: Math.max(1, Math.round(origem.altura * escala)),
  };
}

/**
 * Tamanho da logo no PDF e no DOCX, em pixels a 96 px/pol.: a logo (já rasterizada) reduzida até
 * caber em `LOGO_CAIXA_PT`, mantendo a proporção e **nunca ampliada** — o mesmo resultado nos dois
 * formatos (o PDF converte para pontos com `pxParaPt`).
 */
export function logoNoDocumentoPx(logo: Dimensoes): Dimensoes {
  return encaixar(logo, {
    largura: ptParaPx(LOGO_CAIXA_PT.largura),
    altura: ptParaPx(LOGO_CAIXA_PT.altura),
  });
}

export function ptParaPx(pt: number): number {
  return (pt * PX_POR_POLEGADA) / PT_POR_POLEGADA;
}

export function pxParaPt(px: number): number {
  return (px * PT_POR_POLEGADA) / PX_POR_POLEGADA;
}
