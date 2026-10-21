import type { AtaTypeDefinition } from '../ata-types/types';
import type { JsonSchema } from '../ai/types';
import { STATUS_ENCAMINHAMENTO, TIPOS_BLOCO } from '../domain/draft';
import { CHAVE_ENCAMINHAMENTOS } from '../domain/draft-reducer';

/**
 * Schemas da resposta da IA, no subconjunto aceito pelos três provedores (`ai/types.ts`):
 * só object/array/string/enum, `additionalProperties: false` e todas as propriedades em `required`.
 * A raiz é sempre objeto (exigência da saída estruturada da OpenAI).
 */

function objeto(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const texto: JsonSchema = { type: 'string' };
const listaDe = (items: JsonSchema): JsonSchema => ({ type: 'array', items });

/** Bloco uniforme: "paragrafo" usa `texto` (itens vazio); "lista" usa `itens` (texto vazio). */
const BLOCO: JsonSchema = objeto({
  tipo: { type: 'string', enum: [...TIPOS_BLOCO] },
  texto,
  itens: listaDe(texto),
});

const ENCAMINHAMENTO: JsonSchema = objeto({
  acao: texto,
  responsavel: texto,
  prazo: texto,
  status: { type: 'string', enum: [...STATUS_ENCAMINHAMENTO] },
});

/** `{ secoes: { <chave>: Bloco[] … }, encaminhamentos: Encaminhamento[] }`. */
export function schemaDaAta(tipo: AtaTypeDefinition): JsonSchema {
  const secoes = objeto(
    Object.fromEntries(tipo.secoes.map((s) => [s.chave, listaDe(BLOCO)] as const)),
  );
  return objeto(
    tipo.temEncaminhamentos ? { secoes, encaminhamentos: listaDe(ENCAMINHAMENTO) } : { secoes },
  );
}

/** Chave da seção existe neste tipo (`'encaminhamentos'` só se o tipo os tem). */
export function ehChaveDeSecao(tipo: AtaTypeDefinition, chave: string): boolean {
  if (chave === CHAVE_ENCAMINHAMENTOS) return tipo.temEncaminhamentos;
  return tipo.secoes.some((s) => s.chave === chave);
}

/** Só uma seção: `{ blocos: Bloco[] }`, ou `{ encaminhamentos: Encaminhamento[] }`. */
export function schemaDaSecao(tipo: AtaTypeDefinition, chave: string): JsonSchema {
  if (!ehChaveDeSecao(tipo, chave)) {
    throw new Error(`Seção "${chave}" não existe no tipo de ata "${tipo.id}".`);
  }
  return chave === CHAVE_ENCAMINHAMENTOS
    ? objeto({ encaminhamentos: listaDe(ENCAMINHAMENTO) })
    : objeto({ blocos: listaDe(BLOCO) });
}

/** Nome do schema enviado ao provedor (a OpenAI aceita só letras, dígitos, `_` e `-`). */
export function nomeDoSchema(tipo: AtaTypeDefinition, chave?: string): string {
  const base = `ata_${tipo.id}`;
  return (chave === undefined ? base : `${base}_${chave}`).replace(/[^\w-]/g, '_');
}
