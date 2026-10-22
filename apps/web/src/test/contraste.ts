/** Luminância relativa de uma cor `#rrggbb` (WCAG 2.x). */
function luminancia(cor: string): number {
  const canais = [1, 3, 5].map((i) => {
    const c = parseInt(cor.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = canais;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.x entre duas cores `#rrggbb` (de 1 a 21). */
export function contrasteWcag(corA: string, corB: string): number {
  const [maior, menor] = [luminancia(corA), luminancia(corB)].sort((a, b) => b - a);
  return ((maior ?? 0) + 0.05) / ((menor ?? 0) + 0.05);
}
