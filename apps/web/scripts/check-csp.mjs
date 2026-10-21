// Falha o build se o HTML gerado não cumprir a CSP do Lavra.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CSP } from '../csp.config.js';

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const html = readFileSync(indexPath, 'utf8');

/**
 * Decodifica as entidades que o Vite usa ao serializar atributos (ex.: ' vira &#39;).
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, /** @type {string} */ code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, /** @type {string} */ code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const ATTRIBUTE =
  /(?<name>[^\s"'<>/=]+)(?:\s*=\s*(?:"(?<dq>[^"]*)"|'(?<sq>[^']*)'|(?<bare>[^\s"'=<>`]+)))?/g;

/**
 * Lê os atributos de uma tag (aspas duplas ou simples, ou sem aspas).
 * @param {string} rawAttributes
 * @returns {Map<string, string>}
 */
function parseAttributes(rawAttributes) {
  /** @type {Map<string, string>} */
  const attributes = new Map();
  for (const { groups } of rawAttributes.matchAll(ATTRIBUTE)) {
    if (groups?.name) {
      attributes.set(
        groups.name.toLowerCase(),
        decodeEntities(groups.dq ?? groups.sq ?? groups.bare ?? ''),
      );
    }
  }
  return attributes;
}

/**
 * Atributos de todas as ocorrências da tag no HTML.
 * @param {string} tag
 * @returns {Map<string, string>[]}
 */
function findTags(tag) {
  return [...html.matchAll(new RegExp(String.raw`<${tag}\b([^>]*)>`, 'gi'))].map((match) =>
    parseAttributes(match[1] ?? ''),
  );
}

/** @type {string[]} */
const erros = [];

const metasDeCsp = findTags('meta').filter(
  (attributes) => attributes.get('http-equiv')?.toLowerCase() === 'content-security-policy',
);

if (metasDeCsp.length === 0) {
  erros.push('o <meta> de Content-Security-Policy não foi encontrado em dist/index.html.');
}
for (const meta of metasDeCsp) {
  const content = meta.get('content');
  if (content !== CSP) {
    erros.push(
      `o conteúdo da CSP em dist/index.html difere do definido em csp.config.js:\n    encontrado: ${content ?? '(vazio)'}\n    esperado:   ${CSP}`,
    );
  }
}

for (const script of findTags('script')) {
  if (!script.has('src')) {
    erros.push(
      "há um <script> inline (sem src) em dist/index.html; a CSP (script-src 'self') o bloquearia.",
    );
  }
}

if (/\bsrc\s*=\s*["']?\s*data:/i.test(html)) {
  erros.push('há um src="data:..." em dist/index.html; recursos embutidos não são permitidos.');
}

if (erros.length > 0) {
  console.error('Verificação da CSP falhou:');
  for (const erro of erros) {
    console.error(`  - ${erro}`);
  }
  process.exit(1);
}

console.log('CSP verificada: nenhum script inline');
