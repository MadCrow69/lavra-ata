/** Tempo, em ms, que uma notificação (toast) fica na tela; pausa com o mouse em cima ou o foco dentro. */
export const DURACAO_TOAST_MS = 6_000;

/** Espera, em ms, depois da última alteração para gravar o rascunho na sessão (debounce). */
export const ESPERA_SALVAR_RASCUNHO_MS = 500;

/**
 * Largura máxima (rem) em que a tabela de participantes vira cartões, um por pessoa. Espelha o
 * `@media (max-width: 40rem)` de `features/form/form.module.css` (CSS não importa constante JS):
 * mudar um exige mudar o outro.
 */
export const LARGURA_CARTOES_REM = 40;

/**
 * Espera, em ms, antes de revogar a URL de objeto de um download: revogar na hora cancela o
 * arquivo em alguns navegadores.
 */
export const ESPERA_REVOGAR_URL_MS = 10_000;
