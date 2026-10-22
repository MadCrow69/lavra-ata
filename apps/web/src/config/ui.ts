/** Tempo, em ms, que uma notificação (toast) fica na tela; pausa com o mouse em cima ou o foco dentro. */
export const DURACAO_TOAST_MS = 6_000;

/** Espera, em ms, depois da última alteração para gravar o rascunho na sessão (debounce). */
export const ESPERA_SALVAR_RASCUNHO_MS = 500;

/**
 * Espera, em ms, sem mudança no resumo dos participantes antes de o leitor de tela o anunciar
 * (a região `aria-live` do bloco de participantes).
 */
export const ESPERA_ANUNCIO_RESUMO_MS = 600;

/**
 * Largura máxima (rem) da tela estreita (celular), em que a lista longa de participantes começa
 * recolhida. Espelha os `@media` de 40rem de `features/form/form.module.css` (CSS não importa
 * constante JS): mudar um exige mudar o outro. Os cartões da lista NÃO dependem dela, e sim da
 * largura do próprio bloco (`@container` no mesmo arquivo).
 */
export const LARGURA_TELA_ESTREITA_REM = 40;

/**
 * Espera, em ms, antes de revogar a URL de objeto de um download: revogar na hora cancela o
 * arquivo em alguns navegadores.
 */
export const ESPERA_REVOGAR_URL_MS = 10_000;
