import type { RotuloPessoa } from '../../ata-types/types';
import {
  MAX_CARACTERES_NOME_SUGERIDO,
  NUMERAIS_DO_NOME,
  PARTICULAS_DO_NOME,
  ROTULOS_DE_CAMPO,
  ROTULOS_FALANTE_GENERICO,
  SUFIXOS_DE_CONVIDADO,
} from '../../config/falantes';
import type { Participante } from '../../domain/draft';
import { plural } from '../../ui/plural';
import { falantesDoTexto } from '../transcript/vtt';
import { chaveDeNome, fraseDoLimite, nomeParaGravar } from './lista-participantes';
import { NUMERO_BLOCO } from './numero-bloco';

const NAO_PESSOAS = new Set([...ROTULOS_FALANTE_GENERICO, ...ROTULOS_DE_CAMPO]);
const CONVIDADO = new Set(SUFIXOS_DE_CONVIDADO);
/** Número no fim do rótulo: "Speaker 1", "Participante #2", "Falante 03". */
const NUMERO_FINAL = /\s*#?\d+$/u;
/** Sufixo entre parênteses no fim do nome: "Ana Souza (Convidada)". */
const SUFIXO_FINAL = /\s*\(([^()]*)\)\s*$/u;

/**
 * Não é uma pessoa: rótulo genérico de quem a ferramenta não identificou ("Speaker 1",
 * "Desconhecido") ou rótulo de campo lido como falante no texto colado ("Assunto: …", "Pauta: …").
 */
export function ehRotuloGenerico(nome: string): boolean {
  return NAO_PESSOAS.has(chaveDeNome(nome).replace(NUMERO_FINAL, ''));
}

const LOCALE = 'pt-BR';
const PARTICULAS = new Set(PARTICULAS_DO_NOME);
const NUMERAIS = new Set(NUMERAIS_DO_NOME);
/** Partículas que são prefixo da palavra ("d'"), da mais longa para a mais curta. */
const PREFIXOS = PARTICULAS_DO_NOME.filter((p) => p.endsWith("'")).sort(
  (a, b) => b.length - a.length,
);

/** Primeira letra maiúscula, o resto como veio (já em minúsculas). */
function capitalizar(parte: string): string {
  const [primeira = '', ...resto] = Array.from(parte);
  return primeira.toLocaleUpperCase(LOCALE) + resto.join('');
}

/** "ana-maria" → "Ana-Maria"; "d'avila" → "D'Avila"; "j." → "J.". */
function capitalizarPorParte(palavra: string): string {
  return palavra
    .split(/([-'’])/u)
    .map((parte, i) => (i % 2 === 1 ? parte : capitalizar(parte)))
    .join('');
}

function palavraPadronizada(palavra: string, primeira: boolean): string {
  const minuscula = palavra.toLocaleLowerCase(LOCALE);
  if (primeira) return capitalizarPorParte(minuscula);
  if (PARTICULAS.has(minuscula)) return minuscula;
  if (NUMERAIS.has(minuscula)) return minuscula.toLocaleUpperCase(LOCALE);
  const prefixo = PREFIXOS.find((p) => minuscula.replace('’', "'").startsWith(p));
  return prefixo === undefined || minuscula.length === prefixo.length
    ? capitalizarPorParte(minuscula)
    : minuscula.slice(0, prefixo.length) + capitalizarPorParte(minuscula.slice(prefixo.length));
}

/**
 * Nome escrito todo em maiúsculas ou todo em minúsculas (olhando só as letras) → cada palavra com
 * inicial maiúscula, partículas de `PARTICULAS_DO_NOME` em minúsculas e numerais de
 * `NUMERAIS_DO_NOME` em maiúsculas (salvo a primeira palavra).
 * Nome em caixa mista fica como a pessoa escreveu ("McDonald", "DiCaprio"). Só para o nome sugerido:
 * a transcrição não muda.
 */
export function padronizarCaixaDoNome(nome: string): string {
  const tudoIgual =
    nome === nome.toLocaleUpperCase(LOCALE) || nome === nome.toLocaleLowerCase(LOCALE);
  if (!tudoIgual) return nome;
  let primeira = true;
  return nome
    .split(/(\s+)/u)
    .map((pedaco) => {
      if (pedaco.trim() === '') return pedaco;
      const saida = palavraPadronizada(pedaco, primeira);
      primeira = false;
      return saida;
    })
    .join('');
}

/** Tira o sufixo de convidado da lista em config ("Ana Souza (Convidada)" → "Ana Souza"). */
export function semSufixoDeConvidado(nome: string): string {
  const sufixo = SUFIXO_FINAL.exec(nome);
  if (sufixo?.[1] === undefined || !CONVIDADO.has(chaveDeNome(sufixo[1]))) return nome;
  return nome.slice(0, sufixo.index);
}

export interface SugestaoDeFalantes {
  /** Pessoas nomeadas que falaram, uma por `chaveDeNome`, como serão gravadas. */
  falantes: string[];
  /** Dos `falantes`, os que ainda não estão na lista, na mesma ordem. */
  novos: string[];
}

/**
 * Quem falou e quem disso ainda não está na lista. Fontes: os nomes das marcas `<v>` do .vtt
 * (`falantesDasTags`, como escritos: "Souza, Ana" fica assim) e as falas "Nome: fala" do texto.
 * Iguais pela `chaveDeNome` viram um só (vale a primeira grafia); parecidos mas diferentes ("Ana" ×
 * "Ana Souza") ficam separados: nada é juntado por palpite.
 */
export function sugerirFalantes(
  texto: string,
  participantes: readonly Pick<Participante, 'nome'>[],
  falantesDasTags: readonly string[] = [],
): SugestaoDeFalantes {
  const vistos = new Set<string>();
  const falantes: string[] = [];
  // A regra "Nome: fala" do texto já limita o nome; a marca <v> aceita qualquer comprimento.
  const tags = falantesDasTags.filter((nome) => nome.trim().length <= MAX_CARACTERES_NOME_SUGERIDO);
  for (const bruto of [...tags, ...falantesDoTexto(texto)]) {
    const nome = padronizarCaixaDoNome(nomeParaGravar(semSufixoDeConvidado(bruto)));
    const chave = chaveDeNome(nome);
    if (chave === '' || vistos.has(chave) || ehRotuloGenerico(nome)) continue;
    vistos.add(chave);
    falantes.push(nome);
  }
  const naLista = new Set(participantes.map((p) => chaveDeNome(p.nome)));
  return { falantes, novos: falantes.filter((nome) => !naLista.has(chaveDeNome(nome))) };
}

const LISTA = new Intl.ListFormat('pt-BR', { type: 'conjunction' });

/** "Ana, Rui e Iva"; acima de `max`, "Ana, Rui, Iva e mais 2". */
export function listarNomes(nomes: readonly string[], max: number): string {
  if (nomes.length <= max) return LISTA.format(nomes);
  return LISTA.format([...nomes.slice(0, max), `mais ${String(nomes.length - max)}`]);
}

/** "4 pessoas que falaram" / "1 pessoa que falou". */
export function pessoasQueFalaram(n: number): string {
  return `${String(n)} ${plural(n, 'pessoa que falou', 'pessoas que falaram')}`;
}

export interface ResumoDosFalantes {
  adicionados: number;
  /** Quem falou e já estava na lista (não foi adicionado de novo). */
  jaNaLista: number;
  /** Quem ficou de fora por causa de `LIMITE_PARTICIPANTES`. */
  ignorados: number;
}

/** Aviso depois de "Adicionar como participantes": quantos entraram, onde, e o que ficou de fora. */
export function descreverAdicaoDeFalantes(
  { adicionados, jaNaLista, ignorados }: ResumoDosFalantes,
  pessoa: RotuloPessoa,
): string {
  const partes: string[] = [];
  if (adicionados === 0) {
    partes.push('Nenhum nome foi adicionado.');
  } else {
    const jaEstavam =
      jaNaLista > 0
        ? ` (${String(jaNaLista)} ${plural(jaNaLista, 'já estava', 'já estavam')} na lista)`
        : '';
    partes.push(
      `${String(adicionados)} ${plural(adicionados, `${pessoa.singular} adicionado`, `${pessoa.plural} adicionados`)} ao bloco ${String(NUMERO_BLOCO.participantes)}${jaEstavam}.`,
    );
  }
  if (ignorados > 0) partes.push(fraseDoLimite(ignorados, pessoa));
  return partes.join(' ');
}
