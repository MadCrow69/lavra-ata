import { describe, expect, it } from 'vitest';
import unicodeInter from '@fontsource/inter/unicode.json?raw';
import unicodeSourceSerif from '@fontsource/source-serif-4/unicode.json?raw';
import { RODAPE_PAGINADO } from '../../config/documento';
import type { DocumentModel } from '../../document/model';
import { modeloDeVolume, NOME_DECOMPOSTO } from '../../test/documento-volume';
import { caracteresSemFonte, FAIXAS_FONTE, FONTES_PDF, separarPorFonte } from './cobertura';

/** "U+0000-00FF,U+0131" → [[0x0, 0xff], [0x131, 0x131]] (formato do unicode-range do CSS). */
function faixasDoCss(unicodeRange: string): [number, number][] {
  return unicodeRange.split(',').map((faixa) => {
    const [inicio = '', fim] = faixa.trim().replace(/^U\+/, '').split('-');
    return [parseInt(inicio, 16), parseInt(fim ?? inicio, 16)];
  });
}

function subsets(json: string): Record<string, string> {
  return JSON.parse(json) as Record<string, string>;
}

function modeloCom(texto: string, extras: Partial<DocumentModel> = {}): DocumentModel {
  return {
    titulo: 'Ata',
    cabecalho: { logo: null, linhas: [] },
    blocos: [{ tipo: 'paragrafo', partes: [{ texto }] }],
    rodape: RODAPE_PAGINADO,
    rodapeInterno: null,
    ...extras,
  };
}

describe('faixas de cada fonte = metadados do pacote @fontsource correspondente', () => {
  it('Inter (corpo): latin e latin-ext de @fontsource/inter/unicode.json', () => {
    const inter = subsets(unicodeInter);
    expect(FAIXAS_FONTE.corpo.latin).toEqual(faixasDoCss(inter.latin ?? ''));
    expect(FAIXAS_FONTE.corpo.ext).toEqual(faixasDoCss(inter['latin-ext'] ?? ''));
  });

  it('Source Serif 4 (título): latin e latin-ext do próprio pacote, não as do Inter', () => {
    const serif = subsets(unicodeSourceSerif);
    expect(FAIXAS_FONTE.titulo.latin).toEqual(faixasDoCss(serif.latin ?? ''));
    expect(FAIXAS_FONTE.titulo.ext).toEqual(faixasDoCss(serif['latin-ext'] ?? ''));
  });

  it('nomes das famílias registradas no pdfmake', () => {
    expect(FONTES_PDF).toEqual({
      corpo: { latin: 'Inter', ext: 'InterExt' },
      titulo: { latin: 'SourceSerif', ext: 'SourceSerifExt' },
    });
  });
});

describe('separarPorFonte', () => {
  it('texto pt-BR com pontuação tipográfica fica num trecho só, na fonte latin', () => {
    expect(separarPorFonte('Ação, coração, João — “ok” • 50%', 'corpo')).toEqual([
      { text: 'Ação, coração, João — “ok” • 50%', font: 'Inter' },
    ]);
  });

  it('letra latin-ext vai para a segunda família; o resto continua junto', () => {
    expect(separarPorFonte('Łukasz', 'corpo')).toEqual([
      { text: 'Ł', font: 'InterExt' },
      { text: 'ukasz', font: 'Inter' },
    ]);
    expect(separarPorFonte('Żółć', 'corpo')).toEqual([
      { text: 'Ż', font: 'InterExt' },
      { text: 'ó', font: 'Inter' },
      { text: 'łć', font: 'InterExt' },
    ]);
  });

  it('normaliza em NFC: o acento decomposto (NFD) sai composto e na fonte latin', () => {
    expect(separarPorFonte('João'.normalize('NFD'), 'corpo')).toEqual([
      { text: 'João', font: 'Inter' },
    ]);
  });

  it('a família do título usa SourceSerif e SourceSerifExt', () => {
    expect(separarPorFonte('Ata — Łódź', 'titulo')).toEqual([
      { text: 'Ata — ', font: 'SourceSerif' },
      { text: 'Ł', font: 'SourceSerifExt' },
      { text: 'ód', font: 'SourceSerif' },
      { text: 'ź', font: 'SourceSerifExt' },
    ]);
  });

  it('caractere fora das duas faixas fica na fonte latin (avisado antes de baixar)', () => {
    expect(separarPorFonte('aЖ😀b', 'corpo')).toEqual([{ text: 'aЖ😀b', font: 'Inter' }]);
  });

  it('texto vazio → nenhum trecho', () => {
    expect(separarPorFonte('', 'corpo')).toEqual([]);
  });
});

describe('caracteresSemFonte', () => {
  it('lista por ponto de código (não metade UTF-16), sem repetir, sem espaço nem controle', () => {
    expect(caracteresSemFonte(modeloCom('Ж😀Ж\n\t'))).toEqual(['Ж', '😀']);
  });

  it('ignora invisíveis (U+200B–U+200D, U+FE0E, U+FE0F, U+2060)', () => {
    expect(caracteresSemFonte(modeloCom('a\u200Bb\u200Cc\u200Dd\uFE0Ee\uFE0Ff\u2060g'))).toEqual(
      [],
    );
  });

  it('normaliza em NFC antes de conferir: "João" decomposto não acusa o til solto', () => {
    expect(caracteresSemFonte(modeloCom(NOME_DECOMPOSTO))).toEqual([]);
  });

  it('confere título, cabeçalho e tabelas; ignora o rodapé interno (não é impresso)', () => {
    const modelo = modeloCom('ok', {
      titulo: 'Ata 中',
      cabecalho: { logo: null, linhas: ['Linha Ω'] },
      blocos: [{ tipo: 'tabela', colunas: ['Nome'], linhas: [['Ð', 'א']] }],
      rodapeInterno: 'Минута',
    });
    expect(caracteresSemFonte(modelo)).toEqual(['中', 'Ω', 'א']);
  });

  it('o rascunho de volume (pt-BR, latin-ext e NFD) não tem caractere sem fonte', () => {
    expect(
      caracteresSemFonte(modeloDeVolume({ participantes: 200, encaminhamentos: 200 })),
    ).toEqual([]);
  });
});
