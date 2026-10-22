import type { RotuloPessoa } from '../../ata-types/types';
import { ROTULOS_FALANTE_GENERICO } from '../../config/falantes';
import type { Participante } from '../../domain/draft';
import { semInvisiveis } from '../../domain/texto-invisivel';
import { plural } from '../../ui/plural';
import { falantesDoTexto } from '../transcript/vtt';
import { fraseDoLimite, normalizarBusca } from './lista-participantes';
import { NUMERO_BLOCO } from './numero-bloco';

/**
 * Nome comparável: sem caractere invisível, sem acento, sem diferença de caixa e com espaço simples
 * (`normalizarBusca`, a mesma da busca da lista). Usado dos DOIS lados: falantes e participantes.
 * Só decide "já está na lista?" para NÃO duplicar; nunca escolhe nem altera um participante.
 */
function chaveDoNome(nome: string): string {
  return normalizarBusca(semInvisiveis(nome));
}

const GENERICOS = new Set(ROTULOS_FALANTE_GENERICO);
/** Número no fim do rótulo: "Speaker 1", "Participante #2", "Falante 03". */
const NUMERO_FINAL = /\s*#?\d+$/u;

/** "Speaker 1", "Desconhecido", "Participante 2"…: rótulo de quem a ferramenta não identificou. */
export function ehRotuloGenerico(nome: string): boolean {
  return GENERICOS.has(chaveDoNome(nome).replace(NUMERO_FINAL, ''));
}

export interface SugestaoDeFalantes {
  /** Pessoas nomeadas que falaram, uma por nome comparável, na grafia da primeira fala. */
  falantes: string[];
  /** Dos `falantes`, os que ainda não estão na lista, na mesma ordem. */
  novos: string[];
}

/**
 * Quem falou na transcrição e quem disso ainda não está na lista. Iguais pela `chaveDoNome` viram
 * um só; parecidos mas diferentes ("Ana" × "Ana Souza") ficam separados: nada é juntado por palpite.
 */
export function sugerirFalantes(
  texto: string,
  participantes: readonly Pick<Participante, 'nome'>[],
): SugestaoDeFalantes {
  const vistos = new Set<string>();
  const falantes: string[] = [];
  for (const nome of falantesDoTexto(texto)) {
    const chave = chaveDoNome(nome);
    if (chave === '' || vistos.has(chave) || ehRotuloGenerico(nome)) continue;
    vistos.add(chave);
    falantes.push(nome);
  }
  const naLista = new Set(participantes.map((p) => chaveDoNome(p.nome)));
  return { falantes, novos: falantes.filter((nome) => !naLista.has(chaveDoNome(nome))) };
}

const LISTA = new Intl.ListFormat('pt-BR', { type: 'conjunction' });

/** "Ana, Rui e Iva"; acima de `max`, "Ana, Rui, Iva e mais 2". */
export function listarNomes(nomes: readonly string[], max: number): string {
  if (nomes.length <= max) return LISTA.format(nomes);
  return LISTA.format([...nomes.slice(0, max), `mais ${String(nomes.length - max)}`]);
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
