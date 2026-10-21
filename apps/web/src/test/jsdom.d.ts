/*
 * O jsdom não traz tipos e `@types/jsdom` não é dependência do projeto: declara só o que os testes
 * em ambiente node usam (o `DOMParser` para ler XML).
 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: { readonly DOMParser: typeof DOMParser };
  }
}
