export type ParteRodape = { tipo: 'texto'; texto: string } | { tipo: 'pagina' } | { tipo: 'total' };

const MARCADORES = /(\{pagina\}|\{total\})/;

/** Fatia o modelo do rodapé (`RODAPE_PAGINADO`) em texto fixo, número da página e total. */
export function partesDoRodape(modelo: string): ParteRodape[] {
  const partes: ParteRodape[] = [];
  for (const pedaco of modelo.split(MARCADORES)) {
    if (pedaco === '{pagina}') partes.push({ tipo: 'pagina' });
    else if (pedaco === '{total}') partes.push({ tipo: 'total' });
    else if (pedaco !== '') partes.push({ tipo: 'texto', texto: pedaco });
  }
  return partes;
}
