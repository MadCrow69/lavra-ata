/** Soma das larguras de uma tabela (%). */
const TOTAL_PERCENTUAL = 100;

/** Tolerância para o ponto flutuante nas contas de resto (pesos como 1,5 não são exatos). */
const EPSILON = 1e-9;

/**
 * Pesos das colunas → larguras em % como inteiros ≥ 1 que somam exatamente 100 (maior resto; em
 * empate, vence o menor índice). Fonte única da conta de largura das tabelas do documento: a folha,
 * o PDF (`'43%'`) e o DOCX (`largurasDxa`) leem o resultado.
 *
 * Lança com peso inválido (≤ 0, infinito ou NaN) ou com mais colunas do que 100: ambos são erro de
 * declaração do tipo, pego pelos testes (`colunas-a4.test.ts`), nunca por quem usa o app.
 */
export function largurasPorPeso(pesos: readonly number[]): number[] {
  if (pesos.length === 0) return [];
  if (pesos.length > TOTAL_PERCENTUAL) {
    throw new RangeError(
      `Não cabem ${String(pesos.length)} colunas em ${String(TOTAL_PERCENTUAL)} %.`,
    );
  }
  if (!pesos.every((p) => Number.isFinite(p) && p > 0)) {
    throw new RangeError('O peso de uma coluna precisa ser um número maior que zero.');
  }

  const total = pesos.reduce((soma, p) => soma + p, 0);
  const partes = pesos.map((peso, indice) => {
    const exata = (peso * TOTAL_PERCENTUAL) / total;
    const inteira = Math.floor(exata + EPSILON);
    return { indice, inteira, resto: exata - inteira };
  });

  // Quem recebe os pontos que sobraram do arredondamento para baixo: maior resto, depois menor índice.
  const sobra = TOTAL_PERCENTUAL - partes.reduce((soma, p) => soma + p.inteira, 0);
  const porResto = [...partes].sort(
    (a, b) =>
      (Math.abs(a.resto - b.resto) < EPSILON ? 0 : b.resto - a.resto) || a.indice - b.indice,
  );
  const larguras = partes.map((p) => p.inteira);
  for (const { indice } of porResto.slice(0, sobra)) larguras[indice] = (larguras[indice] ?? 0) + 1;

  // Piso de 1 %: uma coluna que arredondou a 0 pega o ponto da maior, uma a uma.
  for (let i = 0; i < larguras.length; i += 1) {
    while ((larguras[i] ?? 0) < 1) {
      const maior = larguras.indexOf(Math.max(...larguras));
      larguras[maior] = (larguras[maior] ?? 0) - 1;
      larguras[i] = (larguras[i] ?? 0) + 1;
    }
  }
  return larguras;
}
