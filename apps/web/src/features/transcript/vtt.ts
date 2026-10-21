/** Linha de tempo de um cue: `00:00:01.000 --> 00:00:04.000` (horas opcionais) + configurações. */
const LINHA_TEMPO = /^(?:\d+:)?\d{1,2}:\d{2}[.,]\d{3}\s*-->\s*(?:\d+:)?\d{1,2}:\d{2}[.,]\d{3}/;

/** `<v Nome>fala` — o fechamento `</v>` é opcional na especificação. */
const FALANTE_TAG = /^\s*<v(?:\.[^\s.>]+)*\s+([^>\s][^>]*)>/;

/** `Nome: fala` — nome curto, só letras, espaço, ponto, hífen e apóstrofo (até 5 palavras). */
const FALANTE_PREFIXO = /^(\p{L}[\p{L}\p{M}.'’ -]{0,59}?):\s+(\S.*)$/u;
const MAX_PALAVRAS_NOME = 5;

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&lrm;': '',
  '&rlm;': '',
};

/**
 * Remove tags `<...>` em uma passada linear, inclusive aninhadas (`<scr<b>ipt>` vira vazio): equivale
 * a repetir "remover a tag mais interna" até estabilizar, sem custo quadrático. Um `<` sem `>`
 * depois dele fica como texto ("a < b" é preservado); um `>` solto também.
 */
function removerTags(texto: string): string {
  const saida: string[] = [];
  const abertas: number[] = []; // posições, em `saida`, dos `<` ainda sem `>`
  for (const c of texto) {
    if (c === '<') {
      abertas.push(saida.length);
      saida.push(c);
    } else if (c === '>' && abertas.length > 0) {
      saida.length = abertas.pop() ?? 0;
    } else {
      saida.push(c);
    }
  }
  return saida.join('');
}

function limparMarcacao(texto: string): string {
  // A saída é texto puro, exibido como nós de texto do React (nunca HTML): o `<` decodificado é seguro.
  return removerTags(texto)
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|lrm|rlm);/g, (e) => ENTIDADES[e] ?? e)
    .replace(/\s+/g, ' ')
    .trim();
}

interface Fala {
  falante: string | null;
  texto: string;
}

/** Separa falante e fala de UMA linha de cue; `falanteAtual` vale para linhas sem indicação. */
function separarLinha(
  linha: string,
  falanteAtual: string | null,
  permitirPrefixo: boolean,
): { falante: string | null; texto: string } {
  const tag = FALANTE_TAG.exec(linha);
  if (tag?.[1] !== undefined) {
    const nome = limparMarcacao(tag[1]);
    return {
      falante: nome === '' ? null : nome,
      texto: limparMarcacao(linha.slice(tag[0].length)),
    };
  }
  const limpa = limparMarcacao(linha);
  const prefixo = permitirPrefixo ? FALANTE_PREFIXO.exec(limpa) : null;
  if (prefixo?.[1] !== undefined && prefixo[2] !== undefined) {
    const nome = prefixo[1].trim();
    if (nome.split(/\s+/).length <= MAX_PALAVRAS_NOME) return { falante: nome, texto: prefixo[2] };
  }
  return { falante: falanteAtual, texto: limpa };
}

/**
 * Converte o conteúdo de um arquivo WebVTT em texto corrido: "Nome: fala" por linha, sem
 * cabeçalho, notas, identificadores nem timestamps. Falas consecutivas do mesmo falante viram
 * uma só linha; cues sem falante são unidas numa única linha.
 */
export function vttParaTexto(vtt: string): string {
  const semBom = vtt.startsWith(String.fromCharCode(0xfeff)) ? vtt.slice(1) : vtt;
  const linhas = semBom.split(/\r\n|\r|\n/);
  const falas: Fala[] = [];
  let i = 0;

  // Cabeçalho "WEBVTT ..." e tudo até a primeira linha em branco.
  if ((linhas[0] ?? '').startsWith('WEBVTT')) {
    while (i < linhas.length && (linhas[i] ?? '').trim() !== '') i++;
  }

  while (i < linhas.length) {
    // Bloco = linhas até a próxima linha em branco.
    const bloco: string[] = [];
    while (i < linhas.length && (linhas[i] ?? '').trim() !== '') {
      bloco.push(linhas[i] ?? '');
      i++;
    }
    while (i < linhas.length && (linhas[i] ?? '').trim() === '') i++;

    const indiceTempo = bloco.findIndex((l) => LINHA_TEMPO.test(l));
    if (indiceTempo === -1) continue; // NOTE, STYLE, REGION ou lixo: não é fala.

    let falanteDoCue: string | null = null;
    for (const [k, linha] of bloco.slice(indiceTempo + 1).entries()) {
      // "Nome:" só vale na primeira linha do cue; nas seguintes é parte da fala.
      const { falante, texto } = separarLinha(linha, falanteDoCue, k === 0);
      falanteDoCue = falante;
      if (texto !== '') falas.push({ falante, texto });
    }
  }

  const saida: Fala[] = [];
  for (const fala of falas) {
    const ultima = saida.at(-1);
    if (ultima?.falante === fala.falante) ultima.texto += ` ${fala.texto}`;
    else saida.push({ ...fala });
  }
  return saida.map((f) => (f.falante ? `${f.falante}: ${f.texto}` : f.texto)).join('\n');
}
