/** Um instante do cue: `HH:MM:SS.mmm`, horas opcionais; o separador dos milissegundos pode ser vírgula. */
const INSTANTE = String.raw`(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})`;

/**
 * Linha de tempo de um cue: `00:00:01.000 --> 00:00:04.000` + configurações. Os tempos são
 * RELATIVOS ao começo da gravação: não dizem a data nem a hora da reunião.
 */
const LINHA_TEMPO = new RegExp(String.raw`^${INSTANTE}\s*-->\s*${INSTANTE}`);

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
): { falante: string | null; texto: string; daTag: boolean } {
  const tag = FALANTE_TAG.exec(linha);
  if (tag?.[1] !== undefined) {
    const nome = limparMarcacao(tag[1]);
    return {
      falante: nome === '' ? null : nome,
      texto: limparMarcacao(linha.slice(tag[0].length)),
      daTag: true,
    };
  }
  const limpa = limparMarcacao(linha);
  const prefixo = permitirPrefixo ? falanteDoPrefixo(limpa) : null;
  return { ...(prefixo ?? { falante: falanteAtual, texto: limpa }), daTag: false };
}

/**
 * Regra ÚNICA do "Nome: fala": a linha já sem marcação → falante e fala, ou `null` se a linha não
 * começa por um nome (frase com dois-pontos no meio, nome com mais de `MAX_PALAVRAS_NOME` palavras).
 */
function falanteDoPrefixo(linha: string): { falante: string; texto: string } | null {
  const prefixo = FALANTE_PREFIXO.exec(linha);
  if (prefixo?.[1] === undefined || prefixo[2] === undefined) return null;
  const nome = prefixo[1].trim();
  return nome.split(/\s+/).length <= MAX_PALAVRAS_NOME
    ? { falante: nome, texto: prefixo[2] }
    : null;
}

/**
 * Quem fala em cada linha "Nome: fala" do texto da transcrição (o colado, o do .txt ou o que o .vtt
 * virou), na ordem e com repetições, pela mesma regra da conversão do .vtt.
 */
export function falantesDoTexto(texto: string): string[] {
  const falantes: string[] = [];
  for (const linha of texto.split(/\r\n|\r|\n/)) {
    const achado = falanteDoPrefixo(linha.trim());
    if (achado) falantes.push(achado.falante);
  }
  return falantes;
}

/** `HH`, `MM`, `SS`, `mmm` capturados de um `INSTANTE` → milissegundos. */
function instanteEmMs(h: string | undefined, m: string, s: string, ms: string): number {
  return ((Number(h ?? '0') * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms);
}

export interface VttLido {
  /** "Nome: fala" por linha (ver `vttParaTexto`). */
  texto: string;
  /**
   * Do menor início ao maior fim dos cues, em ms; `null` sem cue com tempo. É só a duração da
   * gravação: o .vtt não diz a data nem a hora em que a reunião começou.
   */
  duracaoMs: number | null;
  /**
   * Nomes das marcas `<v Nome>`, como escritos (sem marcação), distintos e na ordem da primeira
   * fala. Guardam o que a regra "Nome: fala" do texto recusa ("Souza, Ana", "Ana (Convidada)").
   */
  falantesDasTags: string[];
}

/**
 * Converte o conteúdo de um arquivo WebVTT em texto corrido: "Nome: fala" por linha, sem
 * cabeçalho, notas, identificadores nem timestamps. Falas consecutivas do mesmo falante viram
 * uma só linha; cues sem falante são unidas numa única linha.
 */
export function vttParaTexto(vtt: string): string {
  return lerVtt(vtt).texto;
}

/** O texto de `vttParaTexto`, a duração da gravação e os nomes das marcas `<v>`, numa só leitura. */
export function lerVtt(vtt: string): VttLido {
  const semBom = vtt.startsWith(String.fromCharCode(0xfeff)) ? vtt.slice(1) : vtt;
  const linhas = semBom.split(/\r\n|\r|\n/);
  const falas: Fala[] = [];
  const falantesDasTags = new Set<string>();
  let primeiroInicio = Infinity;
  let ultimoFim = -Infinity;
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
    const tempo = LINHA_TEMPO.exec(bloco[indiceTempo] ?? '');
    if (tempo === null) continue; // NOTE, STYLE, REGION ou lixo: não é fala.
    const [, h1, m1 = '', s1 = '', ms1 = '', h2, m2 = '', s2 = '', ms2 = ''] = tempo;
    primeiroInicio = Math.min(primeiroInicio, instanteEmMs(h1, m1, s1, ms1));
    ultimoFim = Math.max(ultimoFim, instanteEmMs(h2, m2, s2, ms2));

    let falanteDoCue: string | null = null;
    for (const [k, linha] of bloco.slice(indiceTempo + 1).entries()) {
      // "Nome:" só vale na primeira linha do cue; nas seguintes é parte da fala.
      const { falante, texto, daTag } = separarLinha(linha, falanteDoCue, k === 0);
      falanteDoCue = falante;
      if (daTag && falante !== null) falantesDasTags.add(falante);
      if (texto !== '') falas.push({ falante, texto });
    }
  }

  const saida: Fala[] = [];
  for (const fala of falas) {
    const ultima = saida.at(-1);
    if (ultima?.falante === fala.falante) ultima.texto += ` ${fala.texto}`;
    else saida.push({ ...fala });
  }
  return {
    texto: saida.map((f) => (f.falante ? `${f.falante}: ${f.texto}` : f.texto)).join('\n'),
    duracaoMs: ultimoFim >= primeiroInicio ? ultimoFim - primeiroInicio : null,
    falantesDasTags: [...falantesDasTags],
  };
}
