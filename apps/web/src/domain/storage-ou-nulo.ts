/**
 * `localStorage` ou `sessionStorage` do navegador, ou `null` se o acesso for bloqueado (modo
 * privado, política do navegador, ambiente sem DOM). Fonte única do acesso defensivo ao storage.
 */
export function storageOuNulo(tipo: 'local' | 'session'): Storage | null {
  try {
    const storage = tipo === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    // typeof: fora do navegador a propriedade nem existe.
    return typeof storage === 'undefined' ? null : storage;
  } catch {
    return null;
  }
}
