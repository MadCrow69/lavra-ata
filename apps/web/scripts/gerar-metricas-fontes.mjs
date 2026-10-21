// Gera `src/test/metricas-inter.gerada.ts`: o avanço (em unidades da fonte) de cada caractere do
// Inter regular e negrito — as fontes que o PDF embute no corpo e nas tabelas. O teste
// `src/export/colunas-a4.test.ts` mede com elas se o texto de cada coluna cabe no A4, sem ler
// arquivo de fonte nem precisar do Node (por isso o resultado é versionado como TypeScript).
//
// Rodar à mão sempre que trocar ou atualizar a fonte do corpo:
//   pnpm --filter @lavra/web metricas:fontes
// O teste `gerar-metricas-fontes.test.ts` reprova se o arquivo gerado estiver desatualizado.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { FONTES_EMBUTIDAS, abrirFonte } from './gerar-cobertura-fontes.mjs';

/** Onde o arquivo gerado é gravado. */
export const DESTINO = fileURLToPath(
  new URL('../src/test/metricas-inter.gerada.ts', import.meta.url),
);

/**
 * Regular e negrito do corpo: os mesmos arquivos que o PDF embute (a cobertura confere).
 * @returns {[string, string]}
 */
function arquivosDoCorpo() {
  const [normal, negrito] = FONTES_EMBUTIDAS.corpo.latin;
  if (normal === undefined || negrito === undefined) {
    throw new Error('FONTES_EMBUTIDAS.corpo.latin precisa ter o regular e o negrito.');
  }
  return [normal, negrito];
}

/** U+0020–U+00FF: o latim básico e o suplemento (todo o português). */
const FAIXA_LATINA = [0x20, 0xff];

/** Pontuação tipográfica que um rótulo pode usar: travessões, aspas, marcador, reticências, euro. */
const EXTRAS = [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac];

/**
 * Avanço de cada caractere desenhado pelos dois arquivos. Caractere sem glifo em qualquer um deles
 * fica de fora: `larguraPt` lança em vez de adivinhar.
 * @returns {{ unidadesPorEm: number; normal: [string, number][]; negrito: [string, number][] }}
 */
export function calcularMetricas() {
  const [arquivoNormal, arquivoNegrito] = arquivosDoCorpo();
  const normal = abrirFonte(arquivoNormal);
  const negrito = abrirFonte(arquivoNegrito);
  if (normal.unitsPerEm !== negrito.unitsPerEm) {
    throw new Error('Regular e negrito com unidades por em diferentes.');
  }

  /** @type {number[]} */
  const pontos = [];
  for (let ponto = FAIXA_LATINA[0] ?? 0; ponto <= (FAIXA_LATINA[1] ?? 0); ponto += 1) {
    pontos.push(ponto);
  }
  pontos.push(...EXTRAS);

  const desenhados = pontos.filter(
    (ponto) => normal.hasGlyphForCodePoint(ponto) && negrito.hasGlyphForCodePoint(ponto),
  );
  // Um caractere por vez: sem kerning nem ligadura, a medida é a soma simples dos avanços.
  const avancos = (/** @type {import('fontkit').Font} */ fonte) =>
    desenhados.map((ponto) => {
      const caractere = String.fromCodePoint(ponto);
      return /** @type {[string, number]} */ ([caractere, fonte.layout(caractere).advanceWidth]);
    });
  return { unidadesPorEm: normal.unitsPerEm, normal: avancos(normal), negrito: avancos(negrito) };
}

/** Chave literal: ASCII imprimível como está; o resto como `\uXXXX` (nada invisível no código). */
function chave(/** @type {string} */ caractere) {
  const ponto = caractere.codePointAt(0) ?? 0;
  if (ponto < 0x20 || ponto > 0x7e) return `'\\u${ponto.toString(16).padStart(4, '0')}'`;
  return `'${caractere === "'" || caractere === '\\' ? '\\' : ''}${caractere}'`;
}

/**
 * Texto do arquivo gerado, já formatado pelo Prettier do repositório.
 * @returns {Promise<string>}
 */
export async function conteudoDasMetricas() {
  const metricas = calcularMetricas();
  const mapa = (/** @type {[string, number][]} */ pares) =>
    `{\n${pares.map(([c, avanco]) => `${chave(c)}: ${String(avanco)},`).join('\n')}\n}`;
  const fonte = `// GERADO por apps/web/scripts/gerar-metricas-fontes.mjs — NÃO EDITAR À MÃO.
// Regerar com \`pnpm --filter @lavra/web metricas:fontes\` ao trocar a fonte do corpo do PDF.
// Avanço de cada caractere, sem kerning, em ${arquivosDoCorpo()
    .map((a) => a.split('/').pop() ?? '')
    .join(' e ')}.

/** Avanço (unidades da fonte) por caractere do Inter regular e negrito; \`unidadesPorEm\` converte em pt. */
export const METRICAS_INTER: {
  unidadesPorEm: number;
  normal: Record<string, number>;
  negrito: Record<string, number>;
} = {
unidadesPorEm: ${String(metricas.unidadesPorEm)},
normal: ${mapa(metricas.normal)},
negrito: ${mapa(metricas.negrito)},
};
`;
  const config = (await resolveConfig(DESTINO)) ?? {};
  return format(fonte, { ...config, filepath: DESTINO });
}

const executadoDireto =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  writeFileSync(DESTINO, await conteudoDasMetricas());
  console.log(`Métricas do Inter gravadas em ${DESTINO}`);
}
