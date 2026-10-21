import { formatarData, formatarDataPorExtenso, formatarHora } from '../domain/dates';

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

/** '2026-10-14' → '14/10/2026'; vazia ou inválida → `null`. */
export function dataOuNulo(iso: string | undefined): string | null {
  return formatarOuNulo(formatarData, iso);
}

/**
 * Prazo de encaminhamento: data `AAAA-MM-DD` válida vira `dd/mm/aaaa`; qualquer outro texto
 * ("próxima reunião") é mantido, aparado; vazio → `null` (a folha mostra traço, as tarefas por
 * responsável omitem o prazo). Fonte única da regra.
 */
export function prazoOuNulo(prazo: string | undefined): string | null {
  return dataOuNulo(prazo) ?? (textoLimpo(prazo) || null);
}

export function dataPorExtensoOuNulo(iso: string | undefined): string | null {
  return formatarOuNulo(formatarDataPorExtenso, iso);
}

export function horaOuNulo(hhmm: string | undefined): string | null {
  return formatarOuNulo(formatarHora, hhmm);
}
