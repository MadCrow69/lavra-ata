import type { Bloco, Encaminhamento, Participante } from '../domain/draft';

/** Saída do exemplo no mesmo formato que a IA devolve (`schemaDaAta`), antes da normalização. */
export interface SaidaExemplo {
  secoes: Record<string, Bloco[]>;
  encaminhamentos: Encaminhamento[];
}

/** Um exemplo completo e fictício: formulário preenchido, transcrição e a ata "já gerada". */
export interface Exemplo {
  tipoId: string;
  dados: Record<string, string>;
  pauta: string[];
  /** Ids fixos `exemplo-<tipoId>-NN` (ver `participantesDoExemplo`). */
  participantes: Participante[];
  transcricao: string;
  saida: SaidaExemplo;
  /** SVG da logo fictícia, como texto (`../logo-exemplo.svg?raw`). */
  logoSvg: string;
}
