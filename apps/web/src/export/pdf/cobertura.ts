import { textosDoDocumento } from '../../document/build-model';
import type { DocumentModel } from '../../document/model';

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
 * Faixas de cada subset, copiadas do `unicode.json` do pacote @fontsource de cada fonte (Inter
 * 5.3.0 e Source Serif 4 5.3.1) — o `unicode-range` dos arquivos `.woff` embutidos. Cada família
 * tem as suas (o latin-ext diverge em U+20C1–20C4); `cobertura.test.ts` confere contra os pacotes.
 */
export const FAIXAS_FONTE: Record<FamiliaPdf, { latin: readonly Faixa[]; ext: readonly Faixa[] }> =
  {
    corpo: {
      latin: [
        [0x0000, 0x00ff],
        [0x0131, 0x0131],
        [0x0152, 0x0153],
        [0x02bb, 0x02bc],
        [0x02c6, 0x02c6],
        [0x02da, 0x02da],
        [0x02dc, 0x02dc],
        [0x0304, 0x0304],
        [0x0308, 0x0308],
        [0x0329, 0x0329],
        [0x2000, 0x206f],
        [0x20ac, 0x20ac],
        [0x2122, 0x2122],
        [0x2191, 0x2191],
        [0x2193, 0x2193],
        [0x2212, 0x2212],
        [0x2215, 0x2215],
        [0xfeff, 0xfeff],
        [0xfffd, 0xfffd],
      ],
      ext: [
        [0x0100, 0x02ba],
        [0x02bd, 0x02c5],
        [0x02c7, 0x02cc],
        [0x02ce, 0x02d7],
        [0x02dd, 0x02ff],
        [0x0304, 0x0304],
        [0x0308, 0x0308],
        [0x0329, 0x0329],
        [0x1d00, 0x1dbf],
        [0x1e00, 0x1e9f],
        [0x1ef2, 0x1eff],
        [0x2020, 0x2020],
        [0x20a0, 0x20ab],
        [0x20ad, 0x20c0],
        [0x2113, 0x2113],
        [0x2c60, 0x2c7f],
        [0xa720, 0xa7ff],
      ],
    },
    titulo: {
      latin: [
        [0x0000, 0x00ff],
        [0x0131, 0x0131],
        [0x0152, 0x0153],
        [0x02bb, 0x02bc],
        [0x02c6, 0x02c6],
        [0x02da, 0x02da],
        [0x02dc, 0x02dc],
        [0x0304, 0x0304],
        [0x0308, 0x0308],
        [0x0329, 0x0329],
        [0x2000, 0x206f],
        [0x20ac, 0x20ac],
        [0x2122, 0x2122],
        [0x2191, 0x2191],
        [0x2193, 0x2193],
        [0x2212, 0x2212],
        [0x2215, 0x2215],
        [0xfeff, 0xfeff],
        [0xfffd, 0xfffd],
      ],
      ext: [
        [0x0100, 0x02ba],
        [0x02bd, 0x02c5],
        [0x02c7, 0x02cc],
        [0x02ce, 0x02d7],
        [0x02dd, 0x02ff],
        [0x0304, 0x0304],
        [0x0308, 0x0308],
        [0x0329, 0x0329],
        [0x1d00, 0x1dbf],
        [0x1e00, 0x1e9f],
        [0x1ef2, 0x1eff],
        [0x2020, 0x2020],
        [0x20a0, 0x20ab],
        [0x20ad, 0x20c4],
        [0x2113, 0x2113],
        [0x2c60, 0x2c7f],
        [0xa720, 0xa7ff],
      ],
    },
  };

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
 * Divide o texto (normalizado em NFC) em trechos consecutivos da mesma fonte: o que está no subset
 * `latin` (ou em nenhum dos dois, que sai sem desenho e é avisado antes) usa a fonte latin; o que
 * só o `latin-ext` cobre usa a segunda fonte. Percorre por ponto de código, nunca por metade UTF-16.
 */
export function separarPorFonte(
  texto: string,
  familia: FamiliaPdf,
): { text: string; font: string }[] {
  const trechos: { text: string; font: string }[] = [];
  for (const caractere of texto.normalize('NFC')) {
    const ponto = caractere.codePointAt(0) ?? 0;
    const fonte =
      subsetDe(familia, ponto) === 'ext' ? FONTES_PDF[familia].ext : FONTES_PDF[familia].latin;
    const ultimo = trechos.at(-1);
    if (ultimo?.font === fonte) ultimo.text += caractere;
    else trechos.push({ text: caractere, font: fonte });
  }
  return trechos;
}

/**
 * Caracteres que ninguém vê e que não pedem desenho (espaço, controle, U+200B–U+200D, seletores
 * de variação U+FE0E/U+FE0F, U+2060): não contam como "sem fonte".
 */
const INVISIVEIS = new Set([0x200b, 0x200c, 0x200d, 0xfe0e, 0xfe0f, 0x2060]);
const ESPACO_OU_CONTROLE = /^[\s\p{Cc}]$/u;

function invisivel(caractere: string): boolean {
  return ESPACO_OU_CONTROLE.test(caractere) || INVISIVEIS.has(caractere.codePointAt(0) ?? 0);
}

/**
 * Caracteres impressos no PDF que nenhuma das fontes embutidas desenha (cirílico, emoji, CJK…),
 * únicos, por ponto de código, na ordem em que aparecem. Normaliza em NFC (acento decomposto
 * colado de outro app não acusa) e ignora espaço, controle e invisíveis. Conservador: o caractere
 * precisa de desenho nas DUAS famílias (corpo e título), porque `textosDoDocumento` não diz qual
 * delas imprime cada texto — erra só para o lado de avisar.
 */
export function caracteresSemFonte(modelo: DocumentModel): string[] {
  const vistos = new Set<string>();
  for (const texto of textosDoDocumento(modelo)) {
    for (const caractere of texto.normalize('NFC')) {
      if (vistos.has(caractere) || invisivel(caractere)) continue;
      const ponto = caractere.codePointAt(0) ?? 0;
      if (subsetDe('corpo', ponto) === null || subsetDe('titulo', ponto) === null) {
        vistos.add(caractere);
      }
    }
  }
  return [...vistos];
}
