import { describe, expect, it } from 'vitest';
import readmeEn from '../../../../README.en.md?raw';
import readmePt from '../../../../README.md?raw';
import { ORIGEM_PROVEDOR } from './models';
import { CAMINHOS_CODIGO, SITE } from './site';

/**
 * Os READMEs (pt-BR e inglês) são a vitrine do projeto: os links e os fatos verificáveis que eles
 * citam têm de bater com a fonte única do código. Mudou a URL, o caminho ou o provedor → o teste
 * aponta qual README ficou para trás.
 */
const READMES = [
  {
    nome: 'README.md',
    texto: readmePt,
    outroIdioma: '[English](README.en.md)',
    secao: 'Privacidade: como verificar',
  },
  {
    nome: 'README.en.md',
    texto: readmeEn,
    outroIdioma: '[Português](README.md)',
    secao: 'Privacy: how to verify',
  },
] as const;

describe.each(READMES)('$nome', ({ texto, outroIdioma, secao }) => {
  it('não está vazio (piso: tem título e seções)', () => {
    expect(texto).toMatch(/^# Lavra/);
    expect(texto.match(/^## /gm)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it('cita o site publicado, o LinkedIn do autor e o GIF de demonstração', () => {
    expect(texto).toContain(SITE.demo);
    expect(texto).toContain(SITE.linkedin);
    expect(texto).toContain('docs/demo.gif');
  });

  it('aponta para a versão no outro idioma', () => {
    expect(texto).toContain(outroIdioma);
  });

  it(`tem a seção "${secao}" com o host de cada provedor`, () => {
    expect(texto).toContain(`## ${secao}`);
    for (const origem of Object.values(ORIGEM_PROVEDOR)) {
      expect(texto).toContain(new URL(origem).host);
    }
  });

  it('cita cada caminho de código que a interface também cita', () => {
    const caminhos = Object.values(CAMINHOS_CODIGO);
    expect(caminhos.length).toBeGreaterThan(0);
    for (const caminho of caminhos) expect(texto).toContain(caminho);
  });
});
