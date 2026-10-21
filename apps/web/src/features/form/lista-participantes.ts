import { LIMITE_PARTICIPANTES } from '../../config/limits';
import { plural } from '../../ui/plural';

export interface LinhaParticipante {
  nome: string;
  papel: string;
}

/** Travessão e meia-risca valem com ou sem espaços; hífen só com espaços (senão é parte do nome). */
const SEPARADOR = /\s*[—–\t]\s*|\s+-\s+/;
/** Marcador de lista ("- ", "• ", "* ") ou numeração ("3. ", "2) ") colados junto com a lista. */
const MARCADOR_INICIAL = /^(?:[-•*·]\s+|\d+[.)]\s+)/;
const TEM_LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;

/**
 * Lê a lista colada: uma pessoa por linha, no formato "Nome" ou "Nome — Cargo".
 * Linhas vazias e linhas sem nenhum caractere de texto são ignoradas.
 */
export function analisarLista(texto: string): LinhaParticipante[] {
  const resultado: LinhaParticipante[] = [];
  for (const bruta of texto.split(/\r\n|\r|\n/)) {
    const linha = bruta.trim().replace(MARCADOR_INICIAL, '');
    if (!TEM_LETRA_OU_NUMERO.test(linha)) continue;

    const achado = SEPARADOR.exec(linha);
    const nome = (achado ? linha.slice(0, achado.index) : linha).trim();
    const papel = achado ? linha.slice(achado.index + achado[0].length).trim() : '';
    if (nome === '' || !TEM_LETRA_OU_NUMERO.test(nome)) continue;
    resultado.push({ nome, papel });
  }
  return resultado;
}

/** Minúsculas e sem acento, para a busca achar "João" digitando "joao". */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Quantos dos nomes novos já constam na lista (sem diferenciar caixa nem acento). */
export function contarRepetidos(novos: string[], existentes: string[]): number {
  const conhecidos = new Set(existentes.map(normalizarBusca));
  return novos.filter((nome) => conhecidos.has(normalizarBusca(nome))).length;
}

export interface ResumoAdicao {
  adicionados: number;
  ignorados: number;
  /** Dos adicionados, quantos já estavam na lista. */
  repetidos: number;
}

/** Texto do aviso que a pessoa lê depois de adicionar nomes. */
export function descreverAdicao({ adicionados, ignorados, repetidos }: ResumoAdicao): string {
  const partes: string[] = [];
  if (adicionados === 0) {
    partes.push('Nenhum nome foi adicionado.');
  } else {
    let frase = `${String(adicionados)} ${plural(adicionados, 'participante adicionado', 'participantes adicionados')}`;
    if (repetidos > 0) {
      frase += ` · ${String(repetidos)} ${plural(repetidos, 'já estava', 'já estavam')} na lista (${plural(repetidos, 'mantido', 'mantidos')} em duplicidade — remova se não for o caso)`;
    }
    partes.push(`${frase}.`);
  }
  if (ignorados > 0) {
    partes.push(
      `${String(ignorados)} ${plural(ignorados, 'nome ignorado', 'nomes ignorados')}: o limite é ${String(LIMITE_PARTICIPANTES)} participantes.`,
    );
  }
  return partes.join(' ');
}
