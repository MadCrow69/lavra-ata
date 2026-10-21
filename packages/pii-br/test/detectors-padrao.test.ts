import { describe, expect, it } from 'vitest';
import { cep } from '../src/detectors/cep';
import { email } from '../src/detectors/email';
import { DETECTORS } from '../src/detectors/index';
import { placa } from '../src/detectors/placa';
import { rg } from '../src/detectors/rg';
import { telefone } from '../src/detectors/telefone';
import { normalizeValue } from '../src/normalize';
import { run } from './helpers';

describe('DETECTORS', () => {
  it('segue a ordem de precedência', () => {
    expect(DETECTORS.map((d) => d.type)).toEqual([
      'EMAIL',
      'CNPJ',
      'CPF',
      'PIS',
      'CARTAO',
      'TELEFONE',
      'CEP',
      'PLACA',
      'RG',
    ]);
  });
  it('todos os padrões são globais', () => {
    for (const d of DETECTORS) expect(d.pattern.flags).toContain('g');
  });
});

describe('detector de e-mail', () => {
  it('e-mail com ponto final de frase', () => {
    expect(run(email, 'mande para maria.silva@exemplo.com.br.')).toEqual([
      ['maria.silva@exemplo.com.br', true],
    ]);
  });
  it('plus-addressing e subdomínio', () => {
    expect(run(email, 'use joao+ata@mail.dev.exemplo.org, ok')).toEqual([
      ['joao+ata@mail.dev.exemplo.org', true],
    ]);
  });
  it('vários e-mails no mesmo texto', () => {
    expect(run(email, 'a@x.io e B_2@Y.COM')).toEqual([
      ['a@x.io', true],
      ['B_2@Y.COM', true],
    ]);
  });
  it('arroba sem domínio válido não é e-mail', () => {
    expect(run(email, 'siga @usuario no app')).toEqual([]);
    expect(run(email, 'fulano@localhost')).toEqual([]);
  });
});

describe('detector de telefone', () => {
  it.each([
    '(11) 98888-7777',
    '+55 11 98888-7777',
    '11 3333-4444',
    '(21) 2345-6789',
    '11988887777',
  ])('telefone %s', (t) => {
    expect(run(telefone, `ligue ${t} amanhã`)).toEqual([[t, true]]);
  });
  it.each([
    '+55 (11) 9 8888-7777',
    '+55 11 9 8888 7777',
    '11.98888.7777',
    '(011) 3333-4444',
    '5511988887777',
    '+551133334444',
    '(11)98888-7777',
    '11-3333-4444',
  ])('variante propensa a vazamento %s', (t) => {
    expect(run(telefone, `fale no ${t}.`)).toEqual([[t, true]]);
  });
  it('telefone não casa com horário ou ano', () => {
    expect(run(telefone, 'às 14h30 de 2026')).toEqual([]);
  });
  it('não casa com data, valor em reais ou CEP', () => {
    expect(run(telefone, 'em 14/10/2026 pagou R$ 1.234,56 no CEP 01310-100')).toEqual([]);
  });
  it('não casa dentro de CPF, CNPJ ou cartão', () => {
    expect(run(telefone, 'CPF 529.982.247-25')).toEqual([]);
    expect(run(telefone, 'CNPJ 11.222.333/0001-81')).toEqual([]);
    expect(run(telefone, 'cartão 4111 2222 3333 4444')).toEqual([]);
  });
  it('fixo ou número sem formatação de 10 dígitos não é telefone', () => {
    expect(run(telefone, 'protocolo 1133334444')).toEqual([]);
    expect(run(telefone, 'protocolo 119888877770')).toEqual([]);
  });
  it('0800 e 0300 são linhas de serviço, não pessoais', () => {
    expect(run(telefone, 'SAC 0800 123 4567')).toEqual([]);
    expect(run(telefone, 'SAC 0800-727-0001')).toEqual([]);
  });
  it('intervalo de anos depois de um número não vira telefone', () => {
    expect(run(telefone, 'turma 12 2024-2025')).toEqual([]);
    expect(run(telefone, 'turma 12 2024 2025')).toEqual([]);
  });
  it('com parênteses o fixo cujo miolo parece ano ainda é telefone', () => {
    expect(run(telefone, 'ligue (11) 2024-2025')).toEqual([['(11) 2024-2025', true]]);
  });
  it('celular local 9XXXX-XXXX (sem DDD) é sempre telefone', () => {
    expect(run(telefone, 'meu número é 98888-7777')).toEqual([['98888-7777', true]]);
  });
  it('fixo local XXXX-XXXX (sem DDD) só com contexto', () => {
    expect(run(telefone, 'o fone é 3333-4444')).toEqual([['3333-4444', true]]);
    expect(run(telefone, 'WhatsApp: 3333-4444')).toEqual([['3333-4444', true]]);
    expect(run(telefone, 'ano letivo 2026-2027')).toEqual([]);
    expect(run(telefone, 'conta 3333-4444')).toEqual([]);
  });
  it('dois telefones em sequência', () => {
    expect(run(telefone, '(11) 98888-7777 / (21) 2345-6789')).toEqual([
      ['(11) 98888-7777', true],
      ['(21) 2345-6789', true],
    ]);
  });
  it('lista separada por barra não perde nenhum número', () => {
    expect(run(telefone, '(11) 98888-7777/(21) 98888-6666')).toEqual([
      ['(11) 98888-7777', true],
      ['(21) 98888-6666', true],
    ]);
  });
  it('normaliza com e sem +55 para a mesma chave', () => {
    expect(normalizeValue('TELEFONE', '+55 (11) 9 8888-7777')).toBe(
      normalizeValue('TELEFONE', '11988887777'),
    );
  });
});

describe('detector de CEP', () => {
  it('CEP com hífen', () => {
    expect(run(cep, 'CEP 01310-100')).toEqual([['01310-100', true]]);
  });
  it('CEP com ponto e hífen', () => {
    expect(run(cep, 'fica no 01.310-100.')).toEqual([['01.310-100', true]]);
  });
  it('8 dígitos sem contexto não são CEP', () => {
    expect(run(cep, 'nota 01310100')).toEqual([]);
  });
  it('8 dígitos com contexto são CEP', () => {
    expect(run(cep, 'meu cep é 01310100')).toEqual([['01310100', true]]);
  });
  it('não casa dentro de telefone ou número maior', () => {
    expect(run(cep, 'ligue 98888-7777')).toEqual([]);
    expect(run(cep, 'ligue (11) 98888-7777')).toEqual([]);
    expect(run(cep, 'CEP 0131010099')).toEqual([]);
  });
});

describe('detector de placa', () => {
  it('placa Mercosul', () => {
    expect(run(placa, 'o carro ABC1D23 saiu')).toEqual([['ABC1D23', true]]);
  });
  it('Mercosul em caixa alta é sempre aceita, sem contexto', () => {
    expect(run(placa, 'entrou ABC1D23.')).toEqual([['ABC1D23', true]]);
  });
  it('Mercosul em minúsculas só com contexto', () => {
    expect(run(placa, 'a placa abc1d23 saiu')).toEqual([['abc1d23', true]]);
    expect(run(placa, 'o código abc1d23 saiu')).toEqual([]);
  });
  it('placa antiga só com contexto', () => {
    expect(run(placa, 'placa ABC-1234')).toEqual([['ABC-1234', true]]);
    expect(run(placa, 'certificação ISO-9001')).toEqual([]);
  });
  it('placa antiga sem hífen, com espaço e em minúsculas, com contexto', () => {
    expect(run(placa, 'a moto ABC1234 caiu')).toEqual([['ABC1234', true]]);
    expect(run(placa, 'o veículo ABC 1234 caiu')).toEqual([['ABC 1234', true]]);
    expect(run(placa, 'o caminhão abc-1234 caiu')).toEqual([['abc-1234', true]]);
  });
  it('plural: as duas placas da lista são detectadas', () => {
    expect(run(placa, 'as placas ABC-1234 e DEF-5678')).toEqual([
      ['ABC-1234', true],
      ['DEF-5678', true],
    ]);
  });
  it('"veículo" com acento e sem acento', () => {
    expect(run(placa, 'veiculo DEF-5678')).toEqual([['DEF-5678', true]]);
    expect(run(placa, 'VEÍCULO DEF-5678')).toEqual([['DEF-5678', true]]);
  });
  it('palavras comuns e códigos longos não casam', () => {
    expect(run(placa, 'projeto ABC12D345 e ABCD1234')).toEqual([]);
    expect(run(placa, 'ele disse Abc1d23x')).toEqual([]);
  });
  it('normaliza hífen e espaço para a mesma chave', () => {
    expect(normalizeValue('PLACA', 'abc 1234')).toBe('ABC1234');
    expect(normalizeValue('PLACA', 'ABC-1234')).toBe('ABC1234');
  });
});

describe('detector de RG', () => {
  it('RG com contexto', () => {
    expect(run(rg, 'RG 12.345.678-X')).toEqual([['12.345.678-X', true]]);
  });
  it('RG sem contexto não é detectado', () => {
    expect(run(rg, 'lote 12.345.678-9')).toEqual([]);
  });
  it('RG sem pontuação, com ponto final de frase', () => {
    expect(run(rg, 'identidade 123456789.')).toEqual([['123456789', true]]);
  });
  it('RG com x minúsculo e "registro geral"', () => {
    expect(run(rg, 'Registro Geral: 1.234.567-x')).toEqual([['1.234.567-x', true]]);
  });
  it('RG curto (5 caracteres) e longo (14) com contexto', () => {
    expect(run(rg, 'rg 12345')).toEqual([['12345', true]]);
    expect(run(rg, 'rg 12.345.678-9.1')).toEqual([['12.345.678-9.1', true]]);
  });
  it('4 caracteres ou grudado em letras não é RG', () => {
    expect(run(rg, 'rg 1234')).toEqual([]);
    expect(run(rg, 'rg 12345abc')).toEqual([]);
  });
  it('o contexto precisa vir ANTES do número e ser palavra inteira', () => {
    expect(run(rg, '12.345.678-9 é o RG')).toEqual([]);
    expect(run(rg, 'org 12.345.678-9')).toEqual([]);
  });
});
