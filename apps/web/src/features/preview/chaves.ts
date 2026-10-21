/**
 * Chaves estáveis para listas que só se desenham (sem id próprio): a assinatura do item mais a
 * ocorrência dela, para que itens iguais não colidam e a posição não vire a identidade.
 */
export function chavesUnicas(assinaturas: string[]): string[] {
  const vistas = new Map<string, number>();
  return assinaturas.map((assinatura) => {
    const vez = (vistas.get(assinatura) ?? 0) + 1;
    vistas.set(assinatura, vez);
    return `${assinatura}#${String(vez)}`;
  });
}
