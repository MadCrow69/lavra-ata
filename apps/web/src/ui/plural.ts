/** Escolhe a forma do texto conforme a quantidade: singular só para exatamente 1. */
export function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}
