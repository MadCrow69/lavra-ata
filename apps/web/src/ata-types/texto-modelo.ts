import { formatarDataPorExtenso, formatarHora } from '../domain/dates';

/** Marcador de lacuna que a pessoa vê destacado na folha e deve preencher à mão. */
export function preencher(oQueFalta: string): string {
  return `[PREENCHER: ${oQueFalta}]`;
}

/** Texto digitado, sem espaços nas pontas; `undefined` e vazio viram `''`. */
export function textoLimpo(valor: string | undefined): string {
  return (valor ?? '').trim();
}

/**
 * Aplica um formatador de data/hora que lança `RangeError` em entrada vazia ou inválida.
 * Devolve `null` nesses casos, para o modelo escolher entre lacuna e omissão.
 */
function formatarOuNulo(
  formatar: (valor: string) => string,
  valor: string | undefined,
): string | null {
  const limpo = textoLimpo(valor);
  if (limpo === '') return null;
  try {
    return formatar(limpo);
  } catch (erro) {
    if (erro instanceof RangeError) return null;
    throw erro;
  }
}

export function dataPorExtensoOuNulo(iso: string | undefined): string | null {
  return formatarOuNulo(formatarDataPorExtenso, iso);
}

export function horaOuNulo(hhmm: string | undefined): string | null {
  return formatarOuNulo(formatarHora, hhmm);
}
