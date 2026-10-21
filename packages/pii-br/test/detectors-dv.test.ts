import { describe, expect, it } from 'vitest';
import { hasContext } from '../src/context';
import { cartao } from '../src/detectors/cartao';
import { cnpj } from '../src/detectors/cnpj';
import { cpf } from '../src/detectors/cpf';
import { pis } from '../src/detectors/pis';
import { normalizeValue } from '../src/normalize';
import { run } from './helpers';

describe('detector de CPF', () => {
  it('CPF formatado com DV válido', () => {
    expect(run(cpf, 'CPF 529.982.247-25 ok')).toEqual([['529.982.247-25', true]]);
  });
  it('CPF formatado com DV inválido ainda é mascarado', () => {
    expect(run(cpf, 'doc 529.982.247-24')).toEqual([['529.982.247-24', false]]);
  });
  it('11 dígitos soltos sem DV válido e sem contexto não são CPF', () => {
    expect(run(cpf, 'pedido 12345678901')).toEqual([]);
  });
  it('11 dígitos soltos com DV válido são CPF', () => {
    expect(run(cpf, 'pedido 52998224725')).toEqual([['52998224725', true]]);
  });
  it('11 dígitos soltos com DV inválido e contexto são CPF (valid: false)', () => {
    expect(run(cpf, 'cpf 12345678901')).toEqual([['12345678901', false]]);
  });
  it('cpf com espaços e contexto', () => {
    expect(run(cpf, 'meu CPF é 529 982 247 25')).toEqual([['529 982 247 25', true]]);
  });
  it('cpf com espaços sem contexto não é aceito, mesmo com DV válido', () => {
    expect(run(cpf, 'meu número é 529 982 247 25')).toEqual([]);
  });
  it('não casa dentro de número maior', () => {
    expect(run(cpf, '1529982247250')).toEqual([]);
  });
  it('não casa colado a letras', () => {
    expect(run(cpf, 'A52998224725')).toEqual([]);
  });
  it('detecta mais de uma ocorrência no mesmo texto', () => {
    expect(run(cpf, '529.982.247-25 e 529.982.247-25')).toHaveLength(2);
  });
  it('chamadas repetidas não herdam lastIndex', () => {
    expect(run(cpf, 'CPF 529.982.247-25')).toEqual(run(cpf, 'CPF 529.982.247-25'));
  });
});

describe('detector de CNPJ', () => {
  it('CNPJ numérico formatado', () => {
    expect(run(cnpj, '11.222.333/0001-81')).toEqual([['11.222.333/0001-81', true]]);
  });
  it('CNPJ numérico formatado com DV inválido ainda é aceito', () => {
    expect(run(cnpj, '11.222.333/0001-80')).toEqual([['11.222.333/0001-80', false]]);
  });
  it('CNPJ alfanumérico formatado', () => {
    expect(run(cnpj, 'CNPJ 12.ABC.345/01DE-35')).toEqual([['12.ABC.345/01DE-35', true]]);
  });
  it('CNPJ alfanumérico em minúsculas', () => {
    expect(run(cnpj, '12.abc.345/01de-35')).toEqual([['12.abc.345/01de-35', true]]);
  });
  it('14 caracteres soltos com DV válido são CNPJ', () => {
    expect(run(cnpj, 'ref 11222333000181')).toEqual([['11222333000181', true]]);
  });
  it('14 caracteres soltos sem DV válido e sem contexto não são CNPJ', () => {
    expect(run(cnpj, 'ref 11222333000180')).toEqual([]);
  });
  it('14 caracteres soltos sem DV válido, com contexto, são CNPJ (valid: false)', () => {
    expect(run(cnpj, 'cnpj 11222333000180')).toEqual([['11222333000180', false]]);
  });
  it('não casa dentro de sequência maior', () => {
    expect(run(cnpj, '111222333000181')).toEqual([]);
  });
});

describe('detector de PIS', () => {
  it('PIS formatado', () => {
    expect(run(pis, 'PIS 120.55445.81-4')).toEqual([['120.55445.81-4', true]]);
  });
  it('PIS formatado com DV inválido ainda é aceito', () => {
    expect(run(pis, '120.55445.81-5')).toEqual([['120.55445.81-5', false]]);
  });
  it('11 dígitos soltos com DV válido são PIS', () => {
    expect(run(pis, 'registro 12055445814')).toEqual([['12055445814', true]]);
  });
  it('11 dígitos soltos sem DV válido e sem contexto não são PIS', () => {
    expect(run(pis, 'registro 12055445815')).toEqual([]);
  });
  it('11 dígitos soltos sem DV válido, com contexto, são PIS (valid: false)', () => {
    expect(run(pis, 'NIT 12055445815')).toEqual([['12055445815', false]]);
  });
});

describe('detector de cartão', () => {
  it('cartão exige Luhn', () => {
    expect(run(cartao, 'cartão 4111 1111 1111 1111')).toEqual([['4111 1111 1111 1111', true]]);
    expect(run(cartao, 'cartão 4111 1111 1111 1112')).toEqual([]);
  });
  it('cartão com hífen e sem separador', () => {
    expect(run(cartao, '4111-1111-1111-1111')).toEqual([['4111-1111-1111-1111', true]]);
    expect(run(cartao, '4111111111111111')).toEqual([['4111111111111111', true]]);
  });
  it('rejeita sequência de dígitos todos iguais mesmo passando no Luhn', () => {
    expect(run(cartao, 'cartão 0000 0000 0000 0000')).toEqual([]);
  });
  it('não casa dentro de número maior que 19 dígitos', () => {
    expect(run(cartao, '41111111111111111111')).toEqual([]);
  });
});

describe('normalizeValue', () => {
  it('normaliza formatos diferentes do mesmo CPF', () => {
    expect(normalizeValue('CPF', '529.982.247-25')).toBe(normalizeValue('CPF', '52998224725'));
  });
  it('PIS e cartão ficam só com dígitos', () => {
    expect(normalizeValue('PIS', '120.55445.81-4')).toBe('12055445814');
    expect(normalizeValue('CARTAO', '4111 1111-1111 1111')).toBe('4111111111111111');
  });
  it('CNPJ remove pontuação e põe em maiúsculas', () => {
    expect(normalizeValue('CNPJ', '12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });
  it('e-mail em minúsculas', () => {
    expect(normalizeValue('EMAIL', 'Ana.Silva@Exemplo.COM.br')).toBe('ana.silva@exemplo.com.br');
  });
  it('telefone: só dígitos, sem 55 inicial quando tem 12 ou 13 dígitos', () => {
    expect(normalizeValue('TELEFONE', '+55 (11) 91234-5678')).toBe('11912345678');
    expect(normalizeValue('TELEFONE', '+55 11 3234-5678')).toBe('1132345678');
    expect(normalizeValue('TELEFONE', '(11) 91234-5678')).toBe('11912345678');
    expect(normalizeValue('TELEFONE', '55 1234-5678')).toBe('5512345678');
  });
  it('CEP só dígitos', () => {
    expect(normalizeValue('CEP', '01310-100')).toBe('01310100');
  });
  it('placa em maiúsculas sem hífen', () => {
    expect(normalizeValue('PLACA', 'abc-1d23')).toBe('ABC1D23');
  });
  it('RG mantém dígitos e X maiúsculo', () => {
    expect(normalizeValue('RG', '12.345.678-x')).toBe('12345678X');
  });
});

describe('hasContext', () => {
  it('encontra palavra na janela anterior, sem acento e sem caixa', () => {
    const prefix = 'Cartão de crédito: ';
    expect(hasContext(`${prefix}4111`, prefix.length, ['credito'])).toBe(true);
    expect(hasContext('CPF: 123', 5, ['cpf'])).toBe(true);
  });
  it('palavras com acento na lista também casam', () => {
    expect(hasContext('cartao 123', 7, ['cartão'])).toBe(true);
  });
  it('ignora o que vem depois do início', () => {
    expect(hasContext('123 cpf', 0, ['cpf'])).toBe(false);
  });
  it('respeita a janela', () => {
    const text = `cpf${' '.repeat(40)}123`;
    expect(hasContext(text, text.length - 3, ['cpf'])).toBe(false);
    expect(hasContext(text, text.length - 3, ['cpf'], 50)).toBe(true);
  });
  it('não casa palavra no meio de outra', () => {
    expect(hasContext('comunitário 123', 12, ['nit'])).toBe(false);
  });
});
