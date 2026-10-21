export interface Dimensoes {
  largura: number;
  altura: number;
}

/**
 * Maior retângulo com a proporção de `origem` que cabe em `caixa`. Nunca amplia; arredonda para
 * inteiro e nunca devolve lado menor que 1.
 */
export function encaixar(origem: Dimensoes, caixa: Dimensoes): Dimensoes {
  const escala = Math.min(caixa.largura / origem.largura, caixa.altura / origem.altura, 1);
  return {
    largura: Math.max(1, Math.round(origem.largura * escala)),
    altura: Math.max(1, Math.round(origem.altura * escala)),
  };
}
