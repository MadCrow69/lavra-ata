import interExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff?inline';
import interExt700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff?inline';
import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff?inline';
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff?inline';
import serifExt600 from '@fontsource/source-serif-4/files/source-serif-4-latin-ext-600-normal.woff?inline';
import serifLatin600 from '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff?inline';
import type { TFontDictionary } from 'pdfmake/interfaces';
import { base64DeDataUrl } from '../../document/data-url';
import { FONTES_PDF } from './cobertura';

/*
 * Fontes embutidas no PDF. SÓ `gerar-pdf.ts` importa este módulo: os `.woff` viram data URLs
 * (`?inline`) dentro do chunk carregado sob demanda, sem `fetch` (a CSP não tem `connect-src
 * 'self'`) e sem pesar no bundle inicial. Pacotes estáticos (OFL-1.1): fonte variável não tem
 * suporte confiável no pdfkit.
 */

const ARQUIVOS = {
  'inter-latin-400.woff': interLatin400,
  'inter-latin-700.woff': interLatin700,
  'inter-latin-ext-400.woff': interExt400,
  'inter-latin-ext-700.woff': interExt700,
  'source-serif-4-latin-600.woff': serifLatin600,
  'source-serif-4-latin-ext-600.woff': serifExt600,
} as const;

/** Sistema de arquivos virtual do pdfmake: nome do arquivo → conteúdo em base64 (sem prefixo). */
export const VFS_FONTES: Record<string, string> = Object.fromEntries(
  Object.entries(ARQUIVOS).map(([nome, dataUrl]) => [nome, base64DeDataUrl(dataUrl)]),
);

type Arquivo = keyof typeof ARQUIVOS;

/** Corpo: regular e negrito; o itálico (não usado) cai no desenho reto. */
const corpo = (normal: Arquivo, negrito: Arquivo) => ({
  normal,
  bold: negrito,
  italics: normal,
  bolditalics: negrito,
});

/** Títulos: um só peso (600) para as quatro variantes. */
const titulo = (arquivo: Arquivo) => ({
  normal: arquivo,
  bold: arquivo,
  italics: arquivo,
  bolditalics: arquivo,
});

/** Famílias do pdfmake (substituem o Roboto padrão), com os nomes de `FONTES_PDF`. */
export const FONTES_PDFMAKE: TFontDictionary = {
  [FONTES_PDF.corpo.latin]: corpo('inter-latin-400.woff', 'inter-latin-700.woff'),
  [FONTES_PDF.corpo.ext]: corpo('inter-latin-ext-400.woff', 'inter-latin-ext-700.woff'),
  [FONTES_PDF.titulo.latin]: titulo('source-serif-4-latin-600.woff'),
  [FONTES_PDF.titulo.ext]: titulo('source-serif-4-latin-ext-600.woff'),
};
