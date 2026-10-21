import { describe, expect, it } from 'vitest';
import type { Participante } from '../domain/draft';
import { MENSAGEM_CNPJ_INVALIDO, linhaSe, ou, presentes, validarCnpj } from './comum-formal';

function participante(id: string, parcial: Partial<Participante> = {}): Participante {
  return {
    id,
    nome: `Pessoa ${id}`,
    papel: '',
    presenca: 'presente',
    justificativa: '',
    extras: {},
    ...parcial,
  };
}

describe('validarCnpj', () => {
  it('aceita CNPJ numérico com e sem máscara', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBeNull();
    expect(validarCnpj('11222333000181')).toBeNull();
    expect(validarCnpj(' 11 222 333 0001 81 ')).toBeNull();
  });

  it('aceita CNPJ alfanumérico com máscara e em minúsculas', () => {
    expect(validarCnpj('12.ABC.345/01DE-35')).toBeNull();
    expect(validarCnpj('12abc34501de35')).toBeNull();
  });

  it('recusa dígito verificador errado, tamanho errado e repetição', () => {
    expect(validarCnpj('11.222.333/0001-82')).toBe(MENSAGEM_CNPJ_INVALIDO);
    expect(validarCnpj('12.ABC.345/01DE-36')).toBe(MENSAGEM_CNPJ_INVALIDO);
    expect(validarCnpj('11.222.333/0001')).toBe(MENSAGEM_CNPJ_INVALIDO);
    expect(validarCnpj('00.000.000/0000-00')).toBe(MENSAGEM_CNPJ_INVALIDO);
  });

  it('a mensagem diz a causa e a ação', () => {
    expect(MENSAGEM_CNPJ_INVALIDO).toBe(
      'CNPJ inválido: os dígitos verificadores não conferem. Confira o número.',
    );
  });
});

describe('presentes', () => {
  it('ignora ausente, justificado e nome em branco, mantendo a ordem', () => {
    const lista = [
      participante('a'),
      participante('b', { presenca: 'ausente' }),
      participante('c', { presenca: 'justificado', justificativa: 'Viagem' }),
      participante('d', { nome: '   ' }),
      participante('e'),
    ];
    expect(presentes({ participantes: lista }).map((p) => p.id)).toEqual(['a', 'e']);
  });
});

describe('ou', () => {
  it('devolve o texto limpo ou a lacuna', () => {
    expect(ou('', 'local')).toBe('[PREENCHER: local]');
    expect(ou(undefined, 'local')).toBe('[PREENCHER: local]');
    expect(ou('  ', 'local')).toBe('[PREENCHER: local]');
    expect(ou(' Sala 2 ', 'local')).toBe('Sala 2');
  });
});

describe('linhaSe', () => {
  it('só gera a linha com valor', () => {
    expect(linhaSe('CNPJ', '')).toEqual([]);
    expect(linhaSe('CNPJ', '   ')).toEqual([]);
    expect(linhaSe('CNPJ', null)).toEqual([]);
    expect(linhaSe('CNPJ', undefined)).toEqual([]);
    expect(linhaSe('CNPJ', ' 11.222.333/0001-81 ')).toEqual(['CNPJ: 11.222.333/0001-81']);
  });
});
