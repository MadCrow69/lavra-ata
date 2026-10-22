// Verificação pura da carga inicial do build (usada por check-bundle.mjs): os módulos sob demanda (o
// gerador de PDF/DOCX, as fontes embutidas e os dados dos exemplos) só podem chegar por `import()`
// dinâmico, nunca no que o HTML carrega de cara.
import { listTags } from './csp-verify.mjs';

/**
 * CPF fictício presente só nos dados do modo exemplo — `src/exemplos/ficticios.ts` (fonte única dos
 * identificadores fictícios, importada apenas pelos módulos de `src/exemplos/dados/`).
 */
export const MARCADORES_EXEMPLO = Object.freeze(['529.982.247-25']);

/**
 * Trechos que só existem nos módulos sob demanda: o WOFF em base64 das fontes do PDF ("wOFF" →
 * `d09GRg`), o pdfkit (cabeçalho `%PDF-`), o `docx` (parte `word/document.xml`) e os dados dos
 * exemplos (`MARCADORES_EXEMPLO`).
 */
export const MARCADORES_SOB_DEMANDA = Object.freeze([
  'd09GRg',
  '%PDF-',
  'word/document.xml',
  ...MARCADORES_EXEMPLO,
]);

/**
 * Teto da carga inicial (script de entrada + modulepreload + CSS), em bytes sem compressão. Compensa
 * o `chunkSizeWarningLimit` alto do `vite.config.ts`, que existe só por causa do chunk do PDF.
 */
export const ORCAMENTO_CARGA_INICIAL_BYTES = 500_000;

/**
 * Arquivos que o `index.html` manda o navegador carregar já na abertura: `<script type="module" src>`
 * e `<link rel="modulepreload">` (scripts) e `<link rel="stylesheet">` (estilos), como escritos no
 * HTML. Comentários não valem.
 * @param {string} html
 * @returns {{ scripts: string[], estilos: string[] }}
 */
export function arquivosDaCargaInicial(html) {
  const ativo = html.replace(/<!--[\s\S]*?(?:-->|$)/g, (comentario) =>
    ' '.repeat(comentario.length),
  );
  /** @type {string[]} */
  const scripts = [];
  /** @type {string[]} */
  const estilos = [];
  for (const { tag, attributes } of listTags(ativo)) {
    if (tag === 'script' && attributes.get('type') === 'module') {
      const src = attributes.get('src');
      if (src) scripts.push(src);
    } else if (tag === 'link') {
      const href = attributes.get('href');
      const rel = attributes.get('rel')?.toLowerCase();
      if (!href) continue;
      if (rel === 'modulepreload') scripts.push(href);
      else if (rel === 'stylesheet') estilos.push(href);
    }
  }
  return { scripts, estilos };
}

/**
 * Confere que nenhum arquivo da carga inicial carrega um módulo sob demanda (gerador de PDF/DOCX,
 * fontes ou dados dos exemplos).
 * Devolve a lista de problemas (vazia = aprovado).
 * @param {string} html conteúdo de `dist/index.html`
 * @param {(caminho: string) => string | null} ler conteúdo do arquivo; `null` se não existir
 * @returns {string[]}
 */
export function verificarCargaInicial(html, ler) {
  const { scripts, estilos } = arquivosDaCargaInicial(html);
  /** @type {string[]} */
  const problemas = [];
  if (scripts.length === 0) {
    problemas.push(
      'dist/index.html não referencia nenhum <script type="module">: a carga inicial não pôde ser verificada',
    );
  }
  for (const caminho of new Set([...scripts, ...estilos])) {
    const conteudo = ler(caminho);
    if (conteudo === null) {
      problemas.push(`${caminho} é referenciado em dist/index.html mas não existe`);
      continue;
    }
    for (const marcador of MARCADORES_SOB_DEMANDA) {
      if (conteudo.includes(marcador)) {
        problemas.push(
          `${caminho} contém ${marcador}: um módulo sob demanda (PDF/DOCX, fontes ou dados dos exemplos) entrou na carga inicial`,
        );
      }
    }
  }
  return problemas;
}

const NUMERO = new Intl.NumberFormat('pt-BR');

/**
 * Soma o tamanho da carga inicial e reprova se passar de `ORCAMENTO_CARGA_INICIAL_BYTES`.
 * Arquivo ausente conta zero (quem o reporta é `verificarCargaInicial`).
 * @param {string} html conteúdo de `dist/index.html`
 * @param {(caminho: string) => number | null} tamanhoDe bytes do arquivo; `null` se não existir
 * @returns {{ total: number, problemas: string[] }}
 */
export function verificarOrcamento(html, tamanhoDe) {
  const { scripts, estilos } = arquivosDaCargaInicial(html);
  let total = 0;
  for (const caminho of new Set([...scripts, ...estilos])) total += tamanhoDe(caminho) ?? 0;
  /** @type {string[]} */
  const problemas = [];
  if (total > ORCAMENTO_CARGA_INICIAL_BYTES) {
    problemas.push(
      `a carga inicial tem ${NUMERO.format(total)} bytes e o orçamento é ${NUMERO.format(ORCAMENTO_CARGA_INICIAL_BYTES)}: mova código pesado para import() dinâmico`,
    );
  }
  return { total, problemas };
}
