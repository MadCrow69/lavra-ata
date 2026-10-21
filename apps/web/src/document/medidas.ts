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
