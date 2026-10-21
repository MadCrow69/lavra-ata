import { textosDoDocumento } from '../../document/build-model';
import type { DocBloco, DocumentModel } from '../../document/model';
import { semInvisiveis } from '../../domain/texto-invisivel';
import { COBERTURA_GERADA } from './cobertura-gerada';

/**
 * Cobertura Unicode das fontes embutidas no PDF. Puro (sem pdfmake): pode ir para o bundle
 * principal, para avisar antes de baixar o PDF que algum caractere sairá sem desenho.
 */

/** Faixa inclusiva de pontos de código. */
export type Faixa = readonly [number, number];

export type FamiliaPdf = 'corpo' | 'titulo';

/** Nome de cada família registrada no pdfmake: subset `latin` e subset `latin-ext`. */
export const FONTES_PDF: Record<FamiliaPdf, { latin: string; ext: string }> = {
  corpo: { latin: 'Inter', ext: 'InterExt' },
  titulo: { latin: 'SourceSerif', ext: 'SourceSerifExt' },
};

/**
 * Faixas de cada subset com glifo REAL, geradas do cmap dos `.woff` embutidos
 * (`scripts/gerar-cobertura-fontes.mjs` → `cobertura-gerada.ts`). O `unicode-range` do pacote
 * não serve: declara pontos sem glifo (U+2010, U+2011, U+202F…), que sairiam como caixinha.
 */
export const FAIXAS_FONTE: Record<FamiliaPdf, { latin: readonly Faixa[]; ext: readonly Faixa[] }> =
  COBERTURA_GERADA;

/**
 * Trocas feitas só no PDF, para caracteres comuns em texto de IA e em colagens de chat que as
 * fontes embutidas não desenham mas têm equivalente visual com glifo (`cobertura.test.ts` confere
 * as duas pontas). Espaços tipográficos viram espaço; hífen inquebrável vira hífen comum.
 */
export const SUBSTITUICOES_PDF: ReadonlyMap<number, string> = new Map([
  // Espaços tipográficos (en quad, em quad, 1/3, 1/4, 1/6 de eme, figura, pontuação, fino
  // extra, matemático médio, ideográfico) → espaço comum.
  [0x2000, ' '],
  [0x2001, ' '],
  [0x2003, ' '],
  [0x2004, ' '],
  [0x2005, ' '],
  [0x2006, ' '],
  [0x2007, ' '],
  [0x2008, ' '],
  [0x200a, ' '],
  [0x205f, ' '],
  [0x3000, ' '],
  // Espaço fino inquebrável (comum antes de "%" e em números) → espaço inquebrável (U+00A0).
  [0x202f, String.fromCodePoint(0x00a0)],
  // Separadores de linha e de parágrafo → quebra de linha.
  [0x2028, '\n'],
  [0x2029, '\n'],
  // Hífens e traços sem glifo → o equivalente desenhado.
  [0x2010, '-'],
  [0x2011, '-'],
  [0x2043, '-'],
  [0x2012, '–'],
  [0x2015, '—'],
  // Aspas invertidas → aspas comuns.
  [0x201b, '‘'],
  [0x201f, '“'],
  // Pontos-guia e ponto de hifenização.
  [0x2024, '.'],
  [0x2025, '..'],
  [0x2027, '·'],
]);

/**
 * Texto como o PDF o imprime: NFC, sem formatação invisível nem seletor de variação, e com as
 * trocas de `SUBSTITUICOES_PDF`. `separarPorFonte` e `caracteresSemFonte` partem daqui, então o
 * aviso de "sem fonte" fala exatamente do que sairia no arquivo.
 */
export function prepararTextoPdf(texto: string): string {
  let saida = '';
  for (const caractere of semInvisiveis(texto.normalize('NFC'))) {
    saida += SUBSTITUICOES_PDF.get(caractere.codePointAt(0) ?? 0) ?? caractere;
  }
  return saida;
}

const dentro = (faixas: readonly Faixa[], ponto: number): boolean =>
  faixas.some(([inicio, fim]) => ponto >= inicio && ponto <= fim);

type Subset = 'latin' | 'ext' | null;

function subsetDe(familia: FamiliaPdf, ponto: number): Subset {
  const faixas = FAIXAS_FONTE[familia];
  if (dentro(faixas.latin, ponto)) return 'latin';
  if (dentro(faixas.ext, ponto)) return 'ext';
  return null;
}

/**
 * Divide o texto (já preparado por `prepararTextoPdf`) em trechos consecutivos da mesma fonte: o que está no subset
 * `latin` (ou em nenhum dos dois, que sai sem desenho e é avisado antes) usa a fonte latin; o que
 * só o `latin-ext` cobre usa a segunda fonte. Percorre por ponto de código, nunca por metade UTF-16.
 */
export function separarPorFonte(
  texto: string,
  familia: FamiliaPdf,
): { text: string; font: string }[] {
  const trechos: { text: string; font: string }[] = [];
  for (const caractere of prepararTextoPdf(texto)) {
    const ponto = caractere.codePointAt(0) ?? 0;
    const fonte =
      subsetDe(familia, ponto) === 'ext' ? FONTES_PDF[familia].ext : FONTES_PDF[familia].latin;
    const ultimo = trechos.at(-1);
    if (ultimo?.font === fonte) ultimo.text += caractere;
    else trechos.push({ text: caractere, font: fonte });
  }
  return trechos;
}

const ehControle = (caractere: string): boolean => /^\p{Cc}$/u.test(caractere);

/** Textos impressos na família serifada: título da ata, subtítulos e títulos de seção. */
function textosEmSerifa(modelo: DocumentModel): string[] {
  const titulos = (bloco: DocBloco): string[] => {
    switch (bloco.tipo) {
      case 'titulo':
      case 'subtitulo':
        return [bloco.texto];
      case 'secao':
        return [bloco.titulo, ...bloco.blocos.flatMap(titulos)];
      default:
        return [];
    }
  };
  return [modelo.titulo, ...modelo.blocos.flatMap(titulos)];
}

/**
 * Caracteres impressos no PDF que a fonte que os imprime não desenha (cirílico, emoji, CJK, "‰"…),
 * únicos, por ponto de código, na ordem em que aparecem. Parte do mesmo texto que o PDF recebe
 * (`prepararTextoPdf`: NFC, sem invisíveis, com as trocas) e ignora controles (quebra de linha, tabulação).
 * Todo texto é conferido na família do corpo; título e títulos de seção também na serifada
 * (`definicao.ts` os imprime nela).
 */
export function caracteresSemFonte(modelo: DocumentModel): string[] {
  const faltando = new Set<string>();
  const conferir = (textos: string[], familia: FamiliaPdf) => {
    for (const texto of textos) {
      for (const caractere of prepararTextoPdf(texto)) {
        if (faltando.has(caractere) || ehControle(caractere)) continue;
        if (subsetDe(familia, caractere.codePointAt(0) ?? 0) === null) faltando.add(caractere);
      }
    }
  };
  conferir(textosDoDocumento(modelo), 'corpo');
  conferir(textosEmSerifa(modelo), 'titulo');
  return [...faltando];
}
