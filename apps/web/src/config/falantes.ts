/**
 * Listas da sugestão de participantes tirada da transcrição. Todas escritas já normalizadas:
 * minúsculas, sem acento, espaço simples (um teste confere).
 */

/**
 * Rótulos que ferramentas de transcrição usam quando não sabem quem fala ("Speaker 1",
 * "Participante 2", "Desconhecido"). Não viram participantes. Com número no fim ("Speaker 1"),
 * só chegam pela marca `<v Speaker 1>` do .vtt: a regra "Nome: fala" do texto já recusa dígitos.
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

/**
 * Rótulos de campo que aparecem no texto colado no formato "Rótulo: valor" ("Assunto: orçamento",
 * "Pauta: …") e que a regra "Nome: fala" lê como se fossem pessoas. Não viram participantes.
 */
export const ROTULOS_DE_CAMPO: readonly string[] = [
  'assunto',
  'data',
  'local',
  'pauta',
  'obs',
  'observacao',
  'observacoes',
  'resumo',
  'decisao',
  'decisoes',
  'ata',
  'horario',
  'hora',
  'tema',
  'topico',
  'item',
];

/**
 * Sufixo entre parênteses que algumas ferramentas acrescentam ao nome de quem é de fora
 * ("Ana Souza (Convidada)"). Sai do nome sugerido; o resto fica como escrito.
 */
export const SUFIXOS_DE_CONVIDADO: readonly string[] = [
  'convidado',
  'convidada',
  'guest',
  'externo',
  'externa',
  'external',
];

/** Quantos nomes a sugestão de participantes mostra antes de resumir em "e mais N". */
export const MAX_NOMES_NA_SUGESTAO = 6;
