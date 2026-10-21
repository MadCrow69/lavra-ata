/** Máximo de caracteres da transcrição (≈ 2 h de reunião, com folga). */
export const LIMITE_TRANSCRICAO = 300_000;

/** Máximo de caracteres da instrução livre ao regenerar uma seção. */
export const LIMITE_INSTRUCAO = 1_000;

/** Máximo de participantes por ata. */
export const LIMITE_PARTICIPANTES = 500;

/** Espera, em ms, após a última digitação antes de rodar a detecção de dados pessoais. */
export const DEBOUNCE_DETECCAO_MS = 300;
