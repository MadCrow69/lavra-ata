/*
 * O jsdom não traz tipos e `@types/jsdom` não é dependência do projeto: declara só o que os testes
 * em ambiente node usam (o `DOMParser` para ler XML). Se `@types/jsdom` entrar nas dependências,
 * apague este arquivo.
 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: { readonly DOMParser: typeof DOMParser };
  }
}
