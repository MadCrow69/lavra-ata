import { describe, expect, it } from 'vitest';
import { validarSchema } from './json-schema';
import type { JsonSchema } from './types';

const schema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'status', 'itens'],
  properties: {
    titulo: { type: 'string' },
    status: { type: 'string', enum: ['aberto', 'fechado'] },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nome'],
        properties: { nome: { type: 'string' } },
      },
    },
  },
};

const valido = { titulo: 'Ata', status: 'aberto', itens: [{ nome: 'Item um' }] };

describe('validarSchema', () => {
  it('aceita um valor válido', () => {
    expect(validarSchema(valido, schema)).toEqual([]);
  });

  it('aponta chave extra quando additionalProperties é false', () => {
    const problemas = validarSchema({ ...valido, extra: 'x' }, schema);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('extra');
  });

  it('aponta campo obrigatório ausente', () => {
    const semTitulo: Record<string, unknown> = { ...valido };
    delete semTitulo.titulo;
    const problemas = validarSchema(semTitulo, schema);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('titulo');
  });

  it('aponta valor fora do enum', () => {
    const problemas = validarSchema({ ...valido, status: 'pendente' }, schema);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('status');
  });

  it('aponta tipo errado e informa o caminho aninhado', () => {
    const problemas = validarSchema({ ...valido, itens: [{ nome: 'ok' }, { nome: 42 }] }, schema);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('itens[1].nome');
  });

  it('valida chave extra e campo faltando dentro de itens de array', () => {
    const problemas = validarSchema({ ...valido, itens: [{ outro: 'x' }] }, schema);
    expect(problemas.some((p) => p.includes('itens[0].nome'))).toBe(true);
    expect(problemas.some((p) => p.includes('itens[0].outro'))).toBe(true);
  });

  it('exige campo obrigatório com nome herdado de Object.prototype', () => {
    const texto: JsonSchema = { type: 'string' };
    const propriedades: Record<string, JsonSchema> = Object.fromEntries([['toString', texto]]);
    const s: JsonSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['toString'],
      properties: propriedades,
    };
    expect(validarSchema({}, s)).toHaveLength(1);
    expect(validarSchema({ toString: 'x' }, s)).toEqual([]);
  });

  it('rejeita null, array e primitivo onde se espera objeto', () => {
    expect(validarSchema(null, schema)).not.toEqual([]);
    expect(validarSchema([], schema)).not.toEqual([]);
    expect(validarSchema('texto', schema)).not.toEqual([]);
  });

  it('rejeita objeto onde se espera array', () => {
    expect(validarSchema({ ...valido, itens: {} }, schema)).not.toEqual([]);
  });

  it('valida string solta na raiz', () => {
    expect(validarSchema('a', { type: 'string' })).toEqual([]);
    expect(validarSchema(1, { type: 'string' })).not.toEqual([]);
  });
});
