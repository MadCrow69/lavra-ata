/**
 * Rótulos que ferramentas de transcrição usam quando não sabem quem fala ("Speaker 1",
 * "Participante 2", "Desconhecido"). Um falante com um destes nomes (com ou sem número no fim) não
 * é sugerido como participante. Escritos já normalizados: minúsculas, sem acento, espaço simples
 * (um teste confere).
 */
export const ROTULOS_FALANTE_GENERICO: readonly string[] = [
  'speaker',
  'unknown',
  'unknown speaker',
  'guest',
  'user',
  'desconhecido',
  'desconhecida',
  'participante',
  'falante',
  'orador',
  'oradora',
  'locutor',
  'locutora',
  'interlocutor',
  'interlocutora',
  'convidado',
  'convidada',
  'pessoa',
  'usuario',
  'usuaria',
];

/** Quantos nomes a sugestão de participantes mostra antes de resumir em "e mais N". */
export const MAX_NOMES_NA_SUGESTAO = 6;
