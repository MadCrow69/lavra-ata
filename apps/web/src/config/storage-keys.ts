/** Rascunho da ata — `sessionStorage` (some ao fechar a aba). */
export const RASCUNHO = 'lavra:rascunho:v1';

/** Chaves de API, só com "Lembrar neste navegador" — `localStorage`. */
export const CHAVES = 'lavra:chaves:v1';

/**
 * Preferências do navegador. Formato: `{ versao: 1, tipoId?, tom?, destaque?, ordem?, modelos? }`
 * (lista fechada de campos; nunca transcrição, resultado, participantes nem chaves de IA).
 * `sessionStorage` sempre e `localStorage` só com "Lembrar preferências neste navegador". Com chaves
 * lembradas, a `ordem` e o modelo gravados em `CHAVES` prevalecem sobre os daqui.
 */
export const PREFERENCIAS = 'lavra:preferencias:v1';

/**
 * Logo da organização, em chave PRÓPRIA (nunca dentro do rascunho): `sessionStorage` sempre e
 * `localStorage` só com "Lembrar logo neste navegador". Formato: `{ versao: 1, dataUrl, largura, altura }`.
 */
export const LOGO = 'lavra:logo:v1';
