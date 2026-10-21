/** Rascunho da ata — `sessionStorage` (some ao fechar a aba). */
export const RASCUNHO = 'lavra:rascunho:v1';

/** Chaves de API, só com "Lembrar neste navegador" — `localStorage`. */
export const CHAVES = 'lavra:chaves:v1';

/**
 * Preferências (tom, modelos, tipo) — `localStorage`. Reservada para um plano posterior: nada a lê
 * nem grava ainda; o nome fica aqui para não ser reaproveitado com outro formato.
 */
export const PREFERENCIAS = 'lavra:preferencias:v1';

/**
 * Logo da organização, em chave PRÓPRIA (nunca dentro do rascunho): `sessionStorage` sempre e
 * `localStorage` só com "Lembrar logo neste navegador". Formato: `{ versao: 1, dataUrl, largura, altura }`.
 */
export const LOGO = 'lavra:logo:v1';
