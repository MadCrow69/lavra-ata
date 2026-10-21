import { A4_PT, PAGINA_DOCUMENTO } from '../../config/documento';

/*
 * Medidas do DOCX: o Word conta em vinte avos de ponto (dxa/twips), exceto a imagem, que usa
 * pixels a 96 por polegada. Puro e sem a biblioteca `docx`.
 */

const DXA_POR_PT = 20;

export function ptParaDxa(pt: number): number {
  return Math.round(pt * DXA_POR_PT);
}

/** Página A4 em dxa (210 × 297 mm = 11906 × 16838, os inteiros do Word), derivada de `A4_PT`. */
export const A4_DXA = { largura: ptParaDxa(A4_PT.largura), altura: ptParaDxa(A4_PT.altura) };

/** Pixels a 96 px/pol. (a conversão do PDF e do DOCX é a mesma). */
export { ptParaPx } from '../../document/medidas';

/** Largura da área de texto: a página menos as duas margens laterais. */
export function larguraUtilDxa(): number {
  return A4_DXA.largura - 2 * ptParaDxa(PAGINA_DOCUMENTO.margemPt);
}

const pesoValido = (n: number): boolean => Number.isFinite(n) && n > 0;

/**
 * Larguras das colunas em dxa, somando exatamente `larguraUtilDxa()`. Recebe as larguras em
 * proporção (%); sem elas (ou se não baterem com o número de colunas, ou forem inválidas) divide
 * por igual. Arredonda as bordas acumuladas, então o erro de arredondamento não se acumula e cai
 * na última coluna.
 */
export function largurasDxa(larguras: readonly number[] | undefined, colunas: number): number[] {
  if (colunas <= 0) return [];
  const pesos =
    larguras?.length === colunas && larguras.every(pesoValido)
      ? larguras
      : Array.from({ length: colunas }, () => 1);
  const total = pesos.reduce((a, b) => a + b, 0);
  const util = larguraUtilDxa();
  let acumulado = 0;
  let anterior = 0;
  return pesos.map((peso, i) => {
    acumulado += peso;
    const borda = i === colunas - 1 ? util : Math.round((util * acumulado) / total);
    const largura = borda - anterior;
    anterior = borda;
    return largura;
  });
}
