// Gera `src/export/pdf/cobertura-gerada.ts` a partir dos glifos REAIS (cmap) das fontes que o PDF
// embute. O `unicode-range` do @fontsource só diz o que o subset pretende cobrir; vários pontos
// declarados não têm glifo (U+2010, U+2011, U+202F, U+2030…) e sairiam como caixinha.
//
// Rodar à mão sempre que trocar ou atualizar uma fonte do PDF:
//   pnpm --filter @lavra/web cobertura:fontes
// O teste `gerar-cobertura-fontes.test.ts` reprova se o arquivo gerado estiver desatualizado.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openSync } from 'fontkit';
import { format, resolveConfig } from 'prettier';

const require = createRequire(import.meta.url);

/**
 * Arquivos embutidos por família e subset — os mesmos que `src/export/pdf/arquivos-fonte.ts`
 * importa com `?inline` (o teste confere). Quando a família tem mais de um peso, a cobertura é a
 * interseção: o caractere precisa existir no regular e no negrito.
 */
export const FONTES_EMBUTIDAS = {
  corpo: {
    latin: [
      '@fontsource/inter/files/inter-latin-400-normal.woff',
      '@fontsource/inter/files/inter-latin-700-normal.woff',
    ],
    ext: [
      '@fontsource/inter/files/inter-latin-ext-400-normal.woff',
      '@fontsource/inter/files/inter-latin-ext-700-normal.woff',
    ],
  },
  titulo: {
    latin: ['@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff'],
    ext: ['@fontsource/source-serif-4/files/source-serif-4-latin-ext-600-normal.woff'],
  },
};

/** Onde o arquivo gerado é gravado. */
export const DESTINO = fileURLToPath(
  new URL('../src/export/pdf/cobertura-gerada.ts', import.meta.url),
);

/**
 * @param {string} especificador pacote/caminho do arquivo de fonte
 * @returns {import('fontkit').Font}
 */
export function abrirFonte(especificador) {
  return openSync(require.resolve(especificador));
}

/**
 * Pontos de código que TODOS os arquivos desenham (glifo diferente de .notdef), em ordem.
 * @param {string[]} arquivos
 * @returns {number[]}
 */
export function pontosComGlifo(arquivos) {
  const fontes = arquivos.map(abrirFonte);
  const candidatos = new Set(fontes.flatMap((f) => f.characterSet));
  return [...candidatos]
    .filter((ponto) => fontes.every((f) => f.hasGlyphForCodePoint(ponto)))
    .sort((a, b) => a - b);
}

/**
 * Pontos ordenados → faixas inclusivas de pontos consecutivos.
 * @param {number[]} pontos
 * @returns {[number, number][]}
 */
export function faixasDe(pontos) {
  /** @type {[number, number][]} */
  const faixas = [];
  for (const ponto of pontos) {
    const ultima = faixas.at(-1);
    if (ultima && ponto === ultima[1] + 1) ultima[1] = ponto;
    else faixas.push([ponto, ponto]);
  }
  return faixas;
}

/**
 * Cobertura de cada família e subset, calculada dos arquivos.
 * @returns {Record<'corpo' | 'titulo', Record<'latin' | 'ext', [number, number][]>>}
 */
export function calcularCobertura() {
  const subsets = (/** @type {{ latin: string[]; ext: string[] }} */ arquivos) => ({
    latin: faixasDe(pontosComGlifo(arquivos.latin)),
    ext: faixasDe(pontosComGlifo(arquivos.ext)),
  });
  return { corpo: subsets(FONTES_EMBUTIDAS.corpo), titulo: subsets(FONTES_EMBUTIDAS.titulo) };
}

const hex = (/** @type {number} */ n) => `0x${n.toString(16).padStart(4, '0')}`;

/**
 * Texto do arquivo gerado, já formatado pelo Prettier do repositório.
 * @returns {Promise<string>}
 */
export async function conteudoDaCobertura() {
  const cobertura = calcularCobertura();
  const lista = (/** @type {[number, number][]} */ faixas) =>
    `[\n${faixas.map(([a, b]) => `[${hex(a)}, ${hex(b)}],`).join('\n')}\n]`;
  const familia = (/** @type {'corpo' | 'titulo'} */ nome) =>
    `${nome}: {\nlatin: ${lista(cobertura[nome].latin)},\next: ${lista(cobertura[nome].ext)},\n},`;
  const arquivos = Object.entries(FONTES_EMBUTIDAS)
    .flatMap(([nome, subsets]) =>
      Object.entries(subsets).map(
        ([subset, lista]) =>
          `//   ${nome}.${subset}: ${lista.map((a) => a.split('/').pop()).join(' ∩ ')}`,
      ),
    )
    .join('\n');
  const fonte = `// GERADO por apps/web/scripts/gerar-cobertura-fontes.mjs — NÃO EDITAR À MÃO.
// Regerar com \`pnpm --filter @lavra/web cobertura:fontes\` ao trocar uma fonte do PDF.
// Faixas de pontos de código com glifo real (cmap) em cada arquivo embutido:
${arquivos}

/** Faixas inclusivas de pontos de código que cada família/subset do PDF desenha de fato. */
export const COBERTURA_GERADA: Record<
  'corpo' | 'titulo',
  Record<'latin' | 'ext', readonly (readonly [number, number])[]>
> = {
${familia('corpo')}
${familia('titulo')}
};
`;
  const config = (await resolveConfig(DESTINO)) ?? {};
  return format(fonte, { ...config, filepath: DESTINO });
}

const executadoDireto =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  writeFileSync(DESTINO, await conteudoDaCobertura());
  console.log(`Cobertura das fontes do PDF gravada em ${DESTINO}`);
}
