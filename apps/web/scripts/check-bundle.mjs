// Falha o build se um módulo sob demanda (gerador de PDF/DOCX, fontes ou dados dos exemplos) entrar
// na carga inicial, ou se ela passar do orçamento. Imprime o tamanho de cada chunk sob demanda (para registrar no PR).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  ORCAMENTO_CARGA_INICIAL_BYTES,
  arquivosDaCargaInicial,
  verificarCargaInicial,
  verificarOrcamento,
} from './bundle-verify.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const html = readFileSync(join(dist, 'index.html'), 'utf8');

/**
 * Caminho do arquivo em `dist/` a partir do que o HTML escreve (`/lavra-ata/assets/x.js`): a base
 * do site fica fora da conta, vale o trecho a partir de `assets/`.
 * @param {string} href
 * @returns {string | null}
 */
function emDist(href) {
  const caminho = new URL(href, 'http://local/').pathname;
  const indice = caminho.indexOf('/assets/');
  if (indice < 0) return null;
  const arquivo = join(dist, caminho.slice(indice + 1));
  return existsSync(arquivo) ? arquivo : null;
}

const problemas = [
  ...verificarCargaInicial(html, (href) => {
    const arquivo = emDist(href);
    return arquivo === null ? null : readFileSync(arquivo, 'utf8');
  }),
];
const orcamento = verificarOrcamento(html, (href) => {
  const arquivo = emDist(href);
  return arquivo === null ? null : statSync(arquivo).size;
});
problemas.push(...orcamento.problemas);

/** @param {number} bytes */
const kB = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

const { scripts, estilos } = arquivosDaCargaInicial(html);
const iniciais = new Set([...scripts, ...estilos].map(emDist));
console.log(
  `Carga inicial: ${kB(orcamento.total)} de ${kB(ORCAMENTO_CARGA_INICIAL_BYTES)} (entrada + modulepreload + CSS)`,
);
console.log('Chunks sob demanda (fora da carga inicial):');
for (const nome of readdirSync(join(dist, 'assets')).filter((n) => n.endsWith('.js'))) {
  const arquivo = join(dist, 'assets', nome);
  if (iniciais.has(arquivo)) continue;
  const bytes = readFileSync(arquivo);
  console.log(`  ${nome}: ${kB(bytes.length)} (${kB(gzipSync(bytes).length)} gzip)`);
}

if (problemas.length > 0) {
  console.error('Verificação da carga inicial falhou:');
  for (const problema of problemas) console.error(`  - ${problema}`);
  process.exit(1);
}
console.log('Carga inicial verificada em dist/index.html');
