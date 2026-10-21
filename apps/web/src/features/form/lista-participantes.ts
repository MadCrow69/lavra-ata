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
