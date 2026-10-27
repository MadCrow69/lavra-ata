import type { ProviderConfig } from '../ai/types';

/**
 * O que a pessoa autorizou na última revisão ("Enviar" em "Revise o que vai para a IA"): o
 * conteúdo-base mascarado (dados, pauta, participantes e transcrição; `EnvioDaAta.base`) e os
 * destinos (`provedor:modelo`). Vive só em memória, no `OperacaoIAProvider`: recarregar a página,
 * "Nova ata" e o rascunho recuperado começam sem autorização.
 */
export interface EnvioAutorizado {
  base: string;
  destinos: readonly string[];
}

export const destinoDe = (c: ProviderConfig): string => `${c.id}:${c.modelo}`;

/** Por que um envio precisa (de novo) da revisão; `null` = já autorizado, pode sair direto. */
export type MotivoDaRevisao = 'primeira' | 'conteudo' | 'destino' | 'ata';

/** Linha que a revisão reaberta mostra no topo; a primeira revisão não precisa de explicação. */
export const TEXTO_MOTIVO_REVISAO: Record<MotivoDaRevisao, string | null> = {
  primeira: null,
  conteudo: 'O conteúdo mudou desde a última revisão.',
  destino: 'Há provedor ou modelo novo na fila desde a última revisão.',
  ata: 'A ata mudou desde a última tentativa: enviar de novo substitui o que foi editado.',
};

/**
 * Compara o envio de agora com o autorizado. Sai direto só com o MESMO conteúdo-base e uma fila
 * que não ganhou provedor nem modelo (fila que só encolheu, como uma chave recusada, continua
 * autorizada). O texto da seção e a instrução não entram: estão à vista da pessoa na própria seção.
 */
export function motivoParaRevisar(
  autorizado: EnvioAutorizado | null,
  base: string,
  cadeia: readonly ProviderConfig[],
): MotivoDaRevisao | null {
  if (autorizado === null) return 'primeira';
  if (base !== autorizado.base) return 'conteudo';
  if (!cadeia.every((c) => autorizado.destinos.includes(destinoDe(c)))) return 'destino';
  return null;
}
