import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerDimensoes } from '../logo/validar-logo';
import { SITE } from './site';

/**
 * O card de compartilhamento (Open Graph, LinkedIn) e o ícone ficam como tags estáticas no
 * `index.html` (o Vite não lê `site.ts` no HTML). Este teste é a fonte única: as URLs absolutas
 * batem com `SITE.demo` e os arquivos citados existem em `public/` com o tamanho certo.
 */

const RAIZ = join(import.meta.dirname, '../..');
const HTML = readFileSync(join(RAIZ, 'index.html'), 'utf-8');
const DOC = new DOMParser().parseFromString(HTML, 'text/html');

/** Teto da imagem do card: abre rápido em qualquer conexão. */
const ORCAMENTO_OG_BYTES = 300_000;

function meta(chave: 'name' | 'property', valor: string): string | undefined {
  return DOC.head.querySelector(`meta[${chave}="${valor}"]`)?.getAttribute('content') ?? undefined;
}

function link(rel: string, atributo: string): string | undefined {
  return DOC.head.querySelector(`link[rel="${rel}"]`)?.getAttribute(atributo) ?? undefined;
}

const titulo = DOC.title;

describe('index.html: card de compartilhamento e ícone', () => {
  it('título, descrição e og:title/og:description iguais entre si', () => {
    expect(titulo).toMatch(new RegExp(`^${SITE.nome} — `));
    const descricao = meta('name', 'description');
    expect(descricao?.length).toBeGreaterThan(50);
    expect(meta('property', 'og:title')).toBe(titulo);
    expect(meta('property', 'og:description')).toBe(descricao);
    expect(meta('property', 'og:site_name')).toBe(SITE.nome);
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:locale')).toBe('pt_BR');
  });

  it('og:url e og:image são URLs absolutas https do site publicado (SITE.demo)', () => {
    expect(meta('property', 'og:url')).toBe(SITE.demo);
    expect(meta('property', 'og:image')).toBe(new URL('og-image.png', SITE.demo).href);
    expect(meta('property', 'og:image')).toMatch(/^https:\/\//);
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')?.length).toBeGreaterThan(20);
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('a imagem do card existe em public/, tem 1200×630 e cabe no orçamento', () => {
    const caminho = join(RAIZ, 'public/og-image.png');
    expect(statSync(caminho).size).toBeLessThanOrEqual(ORCAMENTO_OG_BYTES);
    expect(lerDimensoes(new Uint8Array(readFileSync(caminho)), 'png')).toEqual({
      largura: 1200,
      altura: 630,
    });
  });

  it('ícone SVG próprio e PNG para a tela inicial, ambos em public/', () => {
    expect(link('icon', 'href')).toBe('/favicon.svg');
    expect(link('icon', 'type')).toBe('image/svg+xml');
    expect(link('apple-touch-icon', 'href')).toBe('/apple-touch-icon.png');
    const png = new Uint8Array(readFileSync(join(RAIZ, 'public/apple-touch-icon.png')));
    expect(lerDimensoes(png, 'png')).toEqual({ largura: 180, altura: 180 });
  });

  it('o ícone SVG é geométrico (sem texto nem script) e só usa cores dos tokens', () => {
    const svg = readFileSync(join(RAIZ, 'public/favicon.svg'), 'utf-8');
    const tokens = readFileSync(join(RAIZ, 'src/styles/tokens.css'), 'utf-8').toLowerCase();
    expect(svg).not.toMatch(/<text|<script|href=|on\w+=/i);
    const cores = [...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
    expect(cores.length).toBeGreaterThan(0);
    for (const cor of cores) expect(tokens, cor).toContain(cor);
  });
});
