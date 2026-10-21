import { describe, expect, it } from 'vitest';
import { verificarCsp } from './csp-verify.mjs';

const CSP = "default-src 'self'; script-src 'self'; connect-src https://api.exemplo.test";

/** Serializa como o Vite: aspas simples da política viram &#39;. */
const CSP_ESCAPADA = CSP.replace(/'/g, '&#39;');
const META = `<meta http-equiv="Content-Security-Policy" content="${CSP_ESCAPADA}">`;

interface Partes {
  head?: string;
  body?: string;
}

function pagina({ head = '', body = '<div id="root"></div>' }: Partes = {}): string {
  return `<!doctype html><html lang="pt-BR"><head>${META}<meta charset="UTF-8">${head}</head><body>${body}</body></html>`;
}

function semMeta(head: string): string {
  return `<!doctype html><html><head>${head}</head><body></body></html>`;
}

describe('verificarCsp', () => {
  it('aceita a página gerada pelo build (meta primeiro, script e estilo externos)', () => {
    const html = pagina({
      head: '<script type="module" crossorigin src="/lavra-ata/assets/index.js"></script><link rel="stylesheet" href="/lavra-ata/assets/index.css">',
    });

    expect(verificarCsp(html, CSP)).toEqual([]);
  });

  it('aceita atributos com aspas simples, sem aspas e entidades', () => {
    const html = `<!doctype html><head><meta http-equiv='Content-Security-Policy' content='${CSP_ESCAPADA}'></head><body><a href=/lavra-ata/>início</a></body>`;

    expect(verificarCsp(html, CSP)).toEqual([]);
  });

  it('reprova a ausência do <meta> de CSP', () => {
    const erros = verificarCsp(semMeta('<meta charset="UTF-8">'), CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/Content-Security-Policy não foi encontrado/);
  });

  it('reprova conteúdo de CSP diferente do definido', () => {
    const html = pagina().replace(CSP_ESCAPADA, 'default-src *');

    const erros = verificarCsp(html, CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/difere do definido/);
  });

  it('reprova <script> inline', () => {
    const erros = verificarCsp(pagina({ body: '<script>alert(1)</script>' }), CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/<script> inline/);
  });

  it('reprova src="data:"', () => {
    const erros = verificarCsp(pagina({ body: '<img src="data:image/png;base64,AAAA">' }), CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/src="data:/);
  });

  it('reprova href="data:"', () => {
    const erros = verificarCsp(
      pagina({ head: '<link rel="icon" href="data:image/png;base64,AAAA">' }),
      CSP,
    );

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/href="data:/);
  });

  it('reprova <style> inline', () => {
    const erros = verificarCsp(pagina({ head: '<style>body{margin:0}</style>' }), CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/<style> inline/);
  });

  it('reprova o atributo style=', () => {
    const erros = verificarCsp(pagina({ body: '<div style="color:red"></div>' }), CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/atributo style=/);
  });

  it.each([
    ['onclick', '<button onclick="x()">a</button>'],
    ['onload em maiúsculas', '<body ONLOAD="x()"></body>'],
    ['sem aspas', '<img src="/a.png" onerror=x()>'],
  ])('reprova handler inline (%s)', (_nome, corpo) => {
    const erros = verificarCsp(pagina({ body: corpo }), CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/handler inline/);
  });

  it('não confunde atributos que apenas começam com "on" no valor', () => {
    const erros = verificarCsp(pagina({ body: '<a href="/onde" title="onclick">x</a>' }), CSP);

    expect(erros).toEqual([]);
  });

  it('reprova <meta> de CSP dentro de comentário HTML', () => {
    const html = `<!doctype html><head><!-- ${META} --></head><body></body>`;

    const erros = verificarCsp(html, CSP);

    expect(erros.some((e) => e.includes('dentro de um comentário'))).toBe(true);
    // E o comentário não conta como meta válido.
    expect(erros.some((e) => e.includes('não foi encontrado'))).toBe(true);
  });

  it('reprova <meta> em comentário mesmo havendo um meta real', () => {
    const html = pagina({ head: `<!-- ${META} -->` });

    const erros = verificarCsp(html, CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/dentro de um comentário/);
  });

  it('ignora script inline e style= que só aparecem em comentário', () => {
    const html = pagina({ body: '<!-- <script>x()</script> <div style="a:b"></div> -->' });

    expect(verificarCsp(html, CSP)).toEqual([]);
  });

  it('reprova <script src> antes do <meta> de CSP', () => {
    const html = `<!doctype html><head><script type="module" src="/a.js"></script>${META}</head><body></body>`;

    const erros = verificarCsp(html, CSP);

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/antes do <meta>/);
  });

  it('acumula vários problemas na mesma página', () => {
    const html = pagina({
      head: '<style>a{}</style>',
      body: '<p style="x:y" onclick="z()"></p><script>1</script>',
    });

    expect(verificarCsp(html, CSP)).toHaveLength(4);
  });
});
