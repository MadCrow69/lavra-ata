// Verificação pura do HTML do build contra a CSP do Lavra (usada por check-csp.mjs).

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

/** Abertura de qualquer tag; valores entre aspas podem conter `>`. */
const TAG = /<(?<tag>[a-z][^\s/>]*)(?<attrs>(?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

/**
 * Todas as tags de abertura do HTML, com os atributos e a posição no texto.
 * @param {string} html
 * @returns {{ tag: string, attributes: Map<string, string>, index: number }[]}
 */
function listTags(html) {
  return [...html.matchAll(TAG)].map((match) => ({
    tag: (match.groups?.tag ?? '').toLowerCase(),
    attributes: parseAttributes(match.groups?.attrs ?? ''),
    index: match.index,
  }));
}

/**
 * @param {{ attributes: Map<string, string> }} tag
 * @returns {boolean}
 */
function ehMetaDeCsp({ attributes }) {
  return attributes.get('http-equiv')?.toLowerCase() === 'content-security-policy';
}

/**
 * Verifica o HTML gerado contra a CSP. Devolve a lista de problemas (vazia = aprovado).
 * @param {string} html
 * @param {string} csp
 * @returns {string[]}
 */
export function verificarCsp(html, csp) {
  /** @type {string[]} */
  const erros = [];

  // Comentários não valem para o navegador: ficam fora da análise, mas mantêm as posições.
  /** @type {string[]} */
  const comentarios = [];
  const ativo = html.replace(/<!--[\s\S]*?(?:-->|$)/g, (comentario) => {
    comentarios.push(comentario);
    return ' '.repeat(comentario.length);
  });

  if (
    comentarios.some((comentario) =>
      listTags(comentario).some((t) => t.tag === 'meta' && ehMetaDeCsp(t)),
    )
  ) {
    erros.push(
      'há um <meta> de Content-Security-Policy dentro de um comentário HTML; ele não tem efeito.',
    );
  }

  const tags = listTags(ativo);
  const metasDeCsp = tags.filter((t) => t.tag === 'meta' && ehMetaDeCsp(t));

  if (metasDeCsp.length === 0) {
    erros.push('o <meta> de Content-Security-Policy não foi encontrado em dist/index.html.');
  }
  for (const meta of metasDeCsp) {
    const content = meta.attributes.get('content');
    if (content !== csp) {
      erros.push(
        `o conteúdo da CSP em dist/index.html difere do definido em csp.config.js:\n    encontrado: ${content ?? '(vazio)'}\n    esperado:   ${csp}`,
      );
    }
  }

  const primeiroMeta = metasDeCsp[0]?.index ?? Infinity;
  for (const script of tags.filter((t) => t.tag === 'script')) {
    if (!script.attributes.has('src')) {
      erros.push(
        "há um <script> inline (sem src) em dist/index.html; a CSP (script-src 'self') o bloquearia.",
      );
    } else if (script.index < primeiroMeta && metasDeCsp.length > 0) {
      erros.push(
        'há um <script src> antes do <meta> de CSP em dist/index.html; a política só vale para o que vem depois dela.',
      );
    }
  }

  if (tags.some((t) => t.tag === 'style')) {
    erros.push("há um <style> inline em dist/index.html; a CSP (style-src 'self') o bloquearia.");
  }
  if (tags.some((t) => t.attributes.has('style'))) {
    erros.push("há um atributo style= em dist/index.html; a CSP (style-src 'self') o bloquearia.");
  }
  if (tags.some((t) => [...t.attributes.keys()].some((nome) => /^on[a-z]/.test(nome)))) {
    erros.push(
      "há um handler inline (atributo on*=) em dist/index.html; a CSP (script-src 'self') o bloquearia.",
    );
  }

  if (tags.some((t) => /^\s*data:/i.test(t.attributes.get('src') ?? ''))) {
    erros.push('há um src="data:..." em dist/index.html; recursos embutidos não são permitidos.');
  }
  if (tags.some((t) => /^\s*data:/i.test(t.attributes.get('href') ?? ''))) {
    erros.push('há um href="data:..." em dist/index.html; recursos embutidos não são permitidos.');
  }

  return erros;
}
