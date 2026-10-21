/** Máximo de caracteres da transcrição (≈ 2 h de reunião, com folga). */
export const LIMITE_TRANSCRICAO = 300_000;

/** Máximo de caracteres da instrução livre ao regenerar uma seção. */
export const LIMITE_INSTRUCAO = 1_000;

/** Máximo de participantes por ata. */
export const LIMITE_PARTICIPANTES = 500;

/** Espera, em ms, após a última digitação antes de rodar a detecção de dados pessoais. */
export const DEBOUNCE_DETECCAO_MS = 300;

/** Acima desta quantidade, a lista de participantes ganha rolagem com cabeçalho fixo e busca. */
export const PARTICIPANTES_ATE_ROLAGEM = 20;

/** Tamanho máximo, em bytes, do arquivo de transcrição enviado (5 MB). */
export const LIMITE_ARQUIVO_BYTES = 5 * 1024 * 1024;

/** A partir deste percentual de `LIMITE_TRANSCRICAO` o contador passa a avisar. */
export const PERCENTUAL_ALERTA_TRANSCRICAO = 90;
