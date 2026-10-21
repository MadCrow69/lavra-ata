import { LIMITE_PARTICIPANTES } from '../config/limits';

export interface ResultadoAdicao {
  /** Quantos nomes entram de fato na lista. */
  adicionados: number;
  /** Quantos ficam de fora por causa de `LIMITE_PARTICIPANTES`. */
  ignorados: number;
}

/**
 * Fonte única da conta do limite: o reducer decide quantos nomes entram com ela
 * e a tela a usa para avisar quantos foram ignorados.
 */
export function calcularAdicao(atuais: number, solicitados: number): ResultadoAdicao {
  const vagas = Math.max(0, LIMITE_PARTICIPANTES - atuais);
  const adicionados = Math.min(Math.max(0, solicitados), vagas);
  return { adicionados, ignorados: Math.max(0, solicitados) - adicionados };
}
