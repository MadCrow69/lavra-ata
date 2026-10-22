import type { Bloco, Participante, Presenca } from '../domain/draft';

/**
 * Peças dos módulos de `dados/`: participantes com id fixo pela posição e blocos no formato da
 * saída da IA (parágrafo com `itens` vazio; lista com `texto` vazio).
 */

export interface PessoaDoExemplo {
  nome: string;
  papel?: string;
  presenca?: Presenca;
  justificativa?: string;
  extras?: Record<string, string>;
}

/** Participantes com id `exemplo-<tipoId>-NN` (NN = posição na lista, a partir de 01). */
export function participantesDoExemplo(
  tipoId: string,
  pessoas: readonly PessoaDoExemplo[],
): Participante[] {
  return pessoas.map((p, i) => ({
    id: `exemplo-${tipoId}-${String(i + 1).padStart(2, '0')}`,
    nome: p.nome,
    papel: p.papel ?? '',
    presenca: p.presenca ?? 'presente',
    justificativa: p.justificativa ?? '',
    extras: { ...p.extras },
  }));
}

export const paragrafo = (texto: string): Bloco => ({ tipo: 'paragrafo', texto, itens: [] });

export const lista = (itens: string[]): Bloco => ({ tipo: 'lista', texto: '', itens });

/** Transcrição a partir das falas, uma por linha, como a conversão do `.vtt` ("Nome: fala"). */
export const falas = (linhas: readonly string[]): string => linhas.join('\n');
