import { METRICAS_INTER } from './metricas-inter.gerada';

/**
 * Largura (pt) de um texto no Inter regular ou negrito: a soma dos avanços de cada caractere, sem
 * kerning (o kerning só encolhe, então a medida é conservadora). Puro e sem o Node: as métricas
 * vêm de `metricas-inter.gerada.ts`. Caractere sem métrica lança — nunca se adivinha a largura.
 */
export function larguraPt(texto: string, tamanhoPt: number, negrito: boolean): number {
  const tabela = negrito ? METRICAS_INTER.negrito : METRICAS_INTER.normal;
  let unidades = 0;
  for (const caractere of texto) {
    const avanco = tabela[caractere];
    if (avanco === undefined) {
      const ponto = (caractere.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');
      throw new Error(`Sem métrica do Inter para U+${ponto}: gere de novo com metricas:fontes.`);
    }
    unidades += avanco;
  }
  return (unidades / METRICAS_INTER.unidadesPorEm) * tamanhoPt;
}
