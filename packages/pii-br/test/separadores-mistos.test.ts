import { describe, expect, it } from 'vitest';
import { detect } from '../src/detect';

const tipos = (texto: string): [string, string][] =>
  detect(texto).map((f) => [f.type, f.value] as [string, string]);

describe('separadores mistos em CPF, CNPJ e PIS (com rótulo)', () => {
  it.each([
    ['CPF 529.982.247 - 25', '529.982.247 - 25'],
    ['CPF 529 982 247-25', '529 982 247-25'],
    ['CPF 529982247 25', '529982247 25'],
    ['CPF 529,982,247-25', '529,982,247-25'],
    ['CPF 529.982 247-25', '529.982 247-25'],
  ])('%s é CPF', (texto, trecho) => {
    expect(tipos(texto)).toEqual([['CPF', trecho]]);
  });

  it.each([
    ['CNPJ 11.222.333/0001 - 81', '11.222.333/0001 - 81'],
    ['CNPJ 11.222.333 / 0001-81', '11.222.333 / 0001-81'],
    ['CNPJ 11 222 333 0001 81', '11 222 333 0001 81'],
    ['CNPJ 11.222.333 0001-81', '11.222.333 0001-81'],
  ])('%s é CNPJ', (texto, trecho) => {
    expect(tipos(texto)).toEqual([['CNPJ', trecho]]);
  });

  it.each([
    ['PIS 120.55445.81 - 4', '120.55445.81 - 4'],
    ['PIS 120 55445 81-4', '120 55445 81-4'],
    ['NIT 120.55445 81 4', '120.55445 81 4'],
  ])('%s é PIS', (texto, trecho) => {
    expect(tipos(texto)).toEqual([['PIS', trecho]]);
  });

  it('com DV válido e sem espaço, a vírgula basta sem rótulo', () => {
    expect(tipos('titular 529,982,247-25 aprovado')).toEqual([['CPF', '529,982,247-25']]);
  });
});

describe('separadores mistos: sem rótulo, só espaços não bastam', () => {
  it.each([
    'o número 529.982.247 - 25 apareceu',
    'o número 529 982 247-25 apareceu',
    'o número 529982247 25 apareceu',
    'a chave 11.222.333/0001 - 81 apareceu',
    'a chave 11.222.333 / 0001-81 apareceu',
    'a chave 120.55445.81 - 4 apareceu',
  ])('"%s" fica como está', (texto) => {
    expect(tipos(texto)).toEqual([]);
  });
});

describe('separadores mistos: prosa numérica segue intacta', () => {
  it.each([
    'Valor R$ 529.982.247,26 no balanço.',
    'Valor R$ 529.982.247 - 26 no balanço.',
    'Lista: 123 456 789 01 e 987 654 321 00 conforme a tabela.',
    'Totais 123,456,789,01 e 111,222,333,44.',
    'Nos anos 2020 2021 2022 2023 houve crescimento.',
    'Quantidades 100 200 300 400 500 600.',
  ])('"%s" não tem identificador', (texto) => {
    expect(tipos(texto)).toEqual([]);
  });

  it('dinheiro com os mesmos dígitos de um CPF válido é mascarado (privacidade primeiro)', () => {
    expect(tipos('Valor R$ 529.982.247,25 no balanço.')).toEqual([['CPF', '529.982.247,25']]);
  });
});
