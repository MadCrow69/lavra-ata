import type { AtaTypeDefinition } from '../ata-types/types';
import { RESPONSAVEL_A_DEFINIR } from '../config/documento';
import { comoLista as lista, ehRegistro } from '../ai/providers/comum';
import {
  STATUS_ENCAMINHAMENTO,
  type Bloco,
  type Encaminhamento,
  type StatusEncaminhamento,
} from '../domain/draft';

/**
 * Normalização da resposta da IA (spec 8.3). O adaptador já validou o schema; aqui a leitura é
 * defensiva mesmo assim (nada de `as` cego) e aplica as regras de conteúdo: trim, responsável
 * vazio → "A definir", status fora da lista → "pendente", encaminhamento sem ação descartado,
 * bloco vazio descartado, seção ausente → `[]`.
 */

const STATUS_PADRAO: StatusEncaminhamento = 'pendente';

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function ehStatus(v: unknown): v is StatusEncaminhamento {
  return typeof v === 'string' && (STATUS_ENCAMINHAMENTO as readonly string[]).includes(v);
}

function normalizarBloco(v: unknown): Bloco | null {
  if (!ehRegistro(v)) return null;
  const corpo = texto(v.texto);
  if (v.tipo === 'paragrafo') {
    return corpo === '' ? null : { tipo: 'paragrafo', texto: corpo, itens: [] };
  }
  if (v.tipo === 'lista') {
    const itens = lista(v.itens)
      .map(texto)
      .filter((i) => i !== '');
    if (itens.length > 0) return { tipo: 'lista', texto: corpo, itens };
    // Lista sem itens, mas com texto: vira parágrafo para o texto não se perder.
    return corpo === '' ? null : { tipo: 'paragrafo', texto: corpo, itens: [] };
  }
  return null;
}

export function normalizarBlocos(v: unknown): Bloco[] {
  return lista(v)
    .map(normalizarBloco)
    .filter((b): b is Bloco => b !== null);
}

export function normalizarEncaminhamentos(v: unknown): Encaminhamento[] {
  return lista(v).flatMap((item) => {
    if (!ehRegistro(item)) return [];
    const acao = texto(item.acao);
    if (acao === '') return [];
    return [
      {
        acao,
        responsavel: texto(item.responsavel) || RESPONSAVEL_A_DEFINIR,
        prazo: texto(item.prazo),
        status: ehStatus(item.status) ? item.status : STATUS_PADRAO,
      },
    ];
  });
}

export function normalizarResultado(
  bruto: unknown,
  tipo: AtaTypeDefinition,
): { secoes: Record<string, Bloco[]>; encaminhamentos: Encaminhamento[] } {
  const raiz = ehRegistro(bruto) ? bruto : {};
  const secoesBrutas = ehRegistro(raiz.secoes) ? raiz.secoes : {};
  const secoes: Record<string, Bloco[]> = {};
  for (const { chave } of tipo.secoes) {
    secoes[chave] = normalizarBlocos(
      Object.hasOwn(secoesBrutas, chave) ? secoesBrutas[chave] : undefined,
    );
  }
  return {
    secoes,
    encaminhamentos: tipo.temEncaminhamentos ? normalizarEncaminhamentos(raiz.encaminhamentos) : [],
  };
}
