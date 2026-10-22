import { isValidCnpj } from '@lavra/pii-br';
import type { Participante } from '../domain/draft';
import { preencher, textoLimpo } from './texto-modelo';

/**
 * Peças usadas por dois ou mais tipos formais (CIPA, condomínio, sócios de Ltda). O que só um tipo
 * usa fica no módulo do tipo.
 */

/** Dono único da mensagem: os tipos que pedem CNPJ só a consomem (via `validarCnpj`). */
export const MENSAGEM_CNPJ_INVALIDO =
  'CNPJ inválido: os dígitos verificadores não conferem. Confira o número.';

/**
 * `validar` de um campo de CNPJ: aceita com ou sem máscara e o formato alfanumérico (letras em
 * qualquer caixa). Tira tudo fora de `[0-9A-Za-z]`, passa a maiúsculas e confere os dígitos
 * verificadores em `isValidCnpj`; `null` = válido.
 */
export function validarCnpj(texto: string): string | null {
  const normalizado = texto.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return isValidCnpj(normalizado) ? null : MENSAGEM_CNPJ_INVALIDO;
}

/**
 * Participantes listados: os que têm nome preenchido, na ordem da lista (linha sem nome ainda não é
 * uma pessoa da lista). Fonte única da regra.
 */
export function listados(d: { readonly participantes: readonly Participante[] }): Participante[] {
  return d.participantes.filter((p) => p.nome.trim() !== '');
}

/** Participantes presentes com nome preenchido, na ordem da lista. */
export function presentes(d: { readonly participantes: readonly Participante[] }): Participante[] {
  return listados(d).filter((p) => p.presenca === 'presente');
}

/** O texto digitado (aparado) ou a lacuna `[PREENCHER: …]`. */
export function ou(valor: string | undefined, lacuna: string): string {
  return textoLimpo(valor) || preencher(lacuna);
}

/** `["Rótulo: valor"]` quando há valor; senão `[]` (para espalhar numa lista de linhas). */
export function linhaSe(rotulo: string, valor: string | null | undefined): string[] {
  const limpo = textoLimpo(valor ?? undefined);
  return limpo === '' ? [] : [`${rotulo}: ${limpo}`];
}
