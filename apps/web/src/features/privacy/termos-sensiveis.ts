import {
  CATEGORIAS_SENSIVEIS,
  PADRAO_CODIGO_CID,
  type CategoriaSensivel,
} from '../../config/termos-sensiveis';
import { plural } from '../../ui/plural';

/** Trecho do texto ORIGINAL que contém um termo da lista de `config/termos-sensiveis.ts`. */
export interface TermoSensivel {
  start: number;
  /** Posição final (exclusiva). */
  end: number;
  /** `id` da categoria em `CATEGORIAS_SENSIVEIS`. */
  categoria: string;
  /** Discriminante: distingue o termo sensível do dado pessoal e do marcador num destaque. */
  origem: 'termo-sensivel';
}

/** O trecho destacado é um termo sensível (e não um dado pessoal ou marcador)? */
export function ehTermoSensivel(trecho: object): trecho is TermoSensivel {
  return 'origem' in trecho && trecho.origem === 'termo-sensivel';
}

/** Texto normalizado e, para cada caractere dele, o trecho do original que o produziu. */
interface Normalizado {
  texto: string;
  inicio: number[];
  fim: number[];
}

/**
 * Mesma regra de `normalizarBusca` (minúsculas, sem acento), feita caractere a caractere para
 * guardar a posição no original: `toLowerCase` e a decomposição podem mudar o tamanho ("İ" vira
 * "i" + ponto). Espaços não são colapsados aqui: o padrão de cada termo aceita separadores. Marca
 * combinante solta (texto já decomposto) e caractere de formatação invisível (hífen suave, espaço
 * de largura zero, comuns em texto colado de PDF) somem e estendem o caractere anterior, para o
 * destaque cobri-los: "depres" + hífen suave + "são" casa com `depressao`.
 */
function normalizarComPosicoes(original: string): Normalizado {
  let texto = '';
  const inicio: number[] = [];
  const fim: number[] = [];
  let i = 0;
  for (const ch of original) {
    const proximo = i + ch.length;
    const forma = ch
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\p{M}\p{Cf}]/gu, '');
    if (forma === '') {
      if (fim.length > 0) fim[fim.length - 1] = proximo;
    } else {
      texto += forma;
      let unidades = forma.length;
      while (unidades-- > 0) {
        inicio.push(i);
        fim.push(proximo);
      }
    }
    i = proximo;
  }
  return { texto, inicio, fim };
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Entre as palavras de um termo composto: espaço, quebra de linha ou hífen (também tipográfico). */
const SEPARADOR = String.raw`[\s\-‐-―]+`;

/**
 * `afastad* por` → cada palavra com `*` no fim vira radical seguido de letras; entre as palavras,
 * `SEPARADOR`. Letras e separador não se sobrepõem: sem retrocesso combinatório.
 */
function padraoDoTermo(termo: string): string {
  return termo
    .split(' ')
    .map((palavra) =>
      palavra.endsWith('*')
        ? String.raw`${escapar(palavra.slice(0, -1))}[\p{L}\p{N}]*`
        : escapar(palavra),
    )
    .join(SEPARADOR);
}

interface Alternativa {
  fonte: string;
  categoria: string;
  /** Tamanho do literal: o mais longo é tentado primeiro na mesma posição. */
  peso: number;
}

/**
 * Uma expressão só, com um grupo por alternativa e fronteira de palavra Unicode nas pontas. A
 * busca da esquerda para a direita e a ordem das alternativas (código CID primeiro, depois do
 * literal mais longo ao mais curto) dão trechos ordenados, sem sobreposição e o mais longos
 * possível ("licença médica" antes de um termo menor que comece igual).
 */
function compilar(categorias: readonly CategoriaSensivel[]): {
  expressao: RegExp;
  categoriaDoGrupo: string[];
} {
  const alternativas: Alternativa[] = [
    { fonte: PADRAO_CODIGO_CID.fonte, categoria: PADRAO_CODIGO_CID.categoria, peso: Infinity },
    ...categorias.flatMap((c) =>
      c.termos.map((t) => ({ fonte: padraoDoTermo(t), categoria: c.id, peso: t.length })),
    ),
  ].sort((a, b) => b.peso - a.peso);
  const grupos = alternativas.map((a) => `(${a.fonte})`).join('|');
  return {
    expressao: new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${grupos})(?![\p{L}\p{N}])`, 'gu'),
    categoriaDoGrupo: alternativas.map((a) => a.categoria),
  };
}

const COMPILADO = compilar(CATEGORIAS_SENSIVEIS);

/**
 * Trechos com possível dado sensível (só aviso: nada é mascarado). Posições no texto ORIGINAL,
 * em ordem e sem sobreposição; caixa, acento e quebra de linha entre as palavras não importam.
 * Função pura.
 */
export function detectarTermosSensiveis(texto: string): TermoSensivel[] {
  if (texto === '') return [];
  const n = normalizarComPosicoes(texto);
  const { expressao, categoriaDoGrupo } = COMPILADO;
  const achados: TermoSensivel[] = [];
  for (const m of n.texto.matchAll(expressao)) {
    const ini = m.index;
    const ultimo = ini + m[0].length - 1;
    // O grupo que casou diz a categoria (os outros grupos ficam sem valor).
    let grupo = 1;
    while (grupo < m.length && m[grupo] === undefined) grupo++;
    const categoria = categoriaDoGrupo[grupo - 1];
    const start = n.inicio[ini];
    const end = n.fim[ultimo];
    if (categoria === undefined || start === undefined || end === undefined) continue;
    achados.push({ start, end, categoria, origem: 'termo-sensivel' });
  }
  return achados;
}

const ROTULO_POR_ID = new Map(CATEGORIAS_SENSIVEIS.map((c) => [c.id, c.rotulo]));

/** Rótulos das categorias presentes, na ordem de `CATEGORIAS_SENSIVEIS`, sem repetir. */
export function categoriasDosAchados(achados: readonly TermoSensivel[]): string[] {
  const presentes = new Set(achados.map((a) => a.categoria));
  return CATEGORIAS_SENSIVEIS.filter((c) => presentes.has(c.id)).map((c) => c.rotulo);
}

/** Rótulo de uma categoria pelo `id` (o próprio `id` se não existir). */
export function rotuloDaCategoria(id: string): string {
  return ROTULO_POR_ID.get(id) ?? id;
}

/**
 * Trechos distintos (sem diferenciar caixa, acento nem espaço) na ordem em que aparecem, com a
 * categoria do primeiro. Para o aviso listar "afastada" uma vez só, mesmo citada dez vezes.
 */
export function trechosDistintos(
  texto: string,
  achados: readonly TermoSensivel[],
): { trecho: string; categoria: string }[] {
  const vistos = new Set<string>();
  const distintos: { trecho: string; categoria: string }[] = [];
  for (const a of achados) {
    const trecho = texto.slice(a.start, a.end).replace(/\s+/g, ' ');
    const chave = normalizarComPosicoes(trecho).texto;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    distintos.push({ trecho, categoria: a.categoria });
  }
  return distintos;
}

/**
 * "2 trechos com possível dado sensível (saúde, conflito trabalhista) vão como estão — revise
 * antes de enviar." (linha do selo da transcrição).
 */
export function fraseDoAvisoSensivel(achados: readonly TermoSensivel[]): string {
  const n = achados.length;
  const categorias = categoriasDosAchados(achados).join(', ');
  return `${String(n)} ${plural(n, 'trecho', 'trechos')} com possível dado sensível (${categorias}) ${plural(n, 'vai como está', 'vão como estão')} — revise antes de enviar.`;
}
