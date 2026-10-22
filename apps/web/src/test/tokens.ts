import tokens from '../styles/tokens.css?raw';

/**
 * Valor hexadecimal (minúsculo) de uma propriedade customizada de `tokens.css`, só do bloco
 * pedido (padrão `:root`, o tema claro). Para testes que conferem cores do código contra o CSS.
 */
export function tokenDe(nome: string, bloco = ':root'): string | undefined {
  const inicio = tokens.indexOf(`${bloco} {`);
  if (inicio < 0) return undefined;
  const fim = tokens.indexOf('}', inicio);
  const corpo = tokens.slice(inicio, fim < 0 ? undefined : fim);
  return new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(corpo)?.[1]?.toLowerCase();
}
