import { describe, expect, it } from 'vitest';
import { isValidLuhn } from '../src/check-digits';
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
  it('CPF no fim de frase, antes do ponto final', () => {
    expect(run(cpf, 'meu CPF é 529.982.247-25.')).toEqual([['529.982.247-25', true]]);
  });
  it('CPF entre parênteses', () => {
    expect(run(cpf, 'titular (529.982.247-25) confirmado')).toEqual([['529.982.247-25', true]]);
  });
  it.each(['529982247-25', '529.98224725', '529.982.24725'])(
    'CPF parcialmente pontuado %s é detectado com contexto',
    (partial) => {
      expect(run(cpf, `CPF ${partial}`)).toEqual([[partial, true]]);
    },
  );
  it.each(['529982247-24', '529.98224724', '529.982.24724'])(
    'CPF parcialmente pontuado %s com DV inválido e sem contexto não é detectado',
    (partial) => {
      expect(run(cpf, `pedido ${partial}`)).toEqual([]);
    },
  );
  it('CPF parcialmente pontuado com DV inválido e contexto é detectado (valid: false)', () => {
    expect(run(cpf, 'CPF 529982247-24')).toEqual([['529982247-24', false]]);
  });
  it('contexto "nº" colado ao rótulo: nºCPF', () => {
    expect(run(cpf, 'nºCPF 12345678901')).toEqual([['12345678901', false]]);
  });
  it('palavra parecida com o rótulo não dá contexto', () => {
    expect(run(cpf, 'cpfx 12345678901')).toEqual([]);
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

describe('detector de PIS parcialmente pontuado', () => {
  it.each(['120.5544581-4', '12055445.81-4'])('PIS %s com DV válido é detectado', (partial) => {
    expect(run(pis, `registro ${partial}`)).toEqual([[partial, true]]);
  });
  it('PIS parcial com DV inválido e sem contexto não é detectado', () => {
    expect(run(pis, 'registro 120.5544581-5')).toEqual([]);
  });
  it('PIS parcial com DV inválido e contexto é detectado (valid: false)', () => {
    expect(run(pis, 'PIS 120.5544581-5')).toEqual([['120.5544581-5', false]]);
  });
  it('"nisso" não é contexto de PIS', () => {
    expect(run(pis, 'pensei nisso 12345678901')).toEqual([]);
  });
  it.each(['piso', 'pista', 'nitidez'])('"%s" não é contexto de PIS', (word) => {
    expect(run(pis, `${word} 12345678901`)).toEqual([]);
  });
  it('nº colado ao rótulo (nºNIT) é contexto', () => {
    expect(run(pis, 'nºNIT 12345678901')).toEqual([['12345678901', false]]);
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
  it('cartão seguido de validade (MM AA) é detectado exatamente', () => {
    expect(run(cartao, 'cartão 4111 1111 1111 1111 12 28')).toEqual([
      ['4111 1111 1111 1111', true],
    ]);
  });
  it('cartão seguido de CVV separado por espaço leva o CVV junto', () => {
    expect(run(cartao, 'cartão 4111 1111 1111 1111 123')).toEqual([
      ['4111 1111 1111 1111 123', true],
    ]);
  });
  it('cartão colado seguido de validade e CVV', () => {
    expect(run(cartao, '4111111111111111 12 28 123')).toEqual([['4111111111111111', true]]);
  });
  it('cartão Amex (4-6-5) e Diners (4-6-4)', () => {
    expect(run(cartao, '3782 822463 10005')).toEqual([['3782 822463 10005', true]]);
    expect(run(cartao, '3056-930902-5904')).toEqual([['3056-930902-5904', true]]);
  });
  it('separadores misturados (espaço e hífen)', () => {
    expect(run(cartao, '4111 1111-1111 1111')).toEqual([['4111 1111-1111 1111', true]]);
  });
  it('19 dígitos colados com Luhn válido', () => {
    expect(run(cartao, '4111111111111111110')).toEqual([['4111111111111111110', true]]);
  });
  it('não casa dentro de número maior que 19 dígitos', () => {
    expect(run(cartao, '41111111111111111111')).toEqual([]);
  });
  it('trecho que não casa com a estrutura é rejeitado (fail-closed)', () => {
    expect(cartao.accept('abc', 'abc', 0)).toEqual({ ok: false, valid: false });
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

describe('cartão: grupo de 3 a 4 dígitos anexo (CVV) e lacunas de agrupamento', () => {
  it.each([
    'cartão 4111-1111-1111-1111-123',
    'cartão 4111 1111 1111 1111 123',
    'cartão 4111-1111-1111-1111-1111',
    'cartão 4111 1111 1111 1111 1234',
    'cartão 3782 822463 10005 1234',
  ])('o grupo anexo entra no trecho: %s', (text) => {
    const tail = text.replace('cartão ', '');
    expect(run(cartao, text)).toEqual([[tail, true]]);
  });
  it('ano em prosa separado por palavra não é engolido', () => {
    expect(run(cartao, '4111 1111 1111 1111 em 2026')).toEqual([['4111 1111 1111 1111', true]]);
  });
  it('grupo de 2 dígitos (validade) e grupo de 5+ dígitos não são anexados', () => {
    expect(run(cartao, '4111 1111 1111 1111 12 28')).toEqual([['4111 1111 1111 1111', true]]);
    expect(run(cartao, '4111 1111 1111 1111 12345')).toEqual([['4111 1111 1111 1111', true]]);
  });
  it('cartão de 19 dígitos agrupado 4-4-4-4-3 com Luhn válido é detectado inteiro', () => {
    expect(run(cartao, 'cartão 4111 1111 1111 1111 110')).toEqual([
      ['4111 1111 1111 1111 110', true],
    ]);
  });
  it('Visa de 13 dígitos agrupado 4-4-4-1', () => {
    expect(run(cartao, 'cartão 4222 2222 2222 2')).toEqual([['4222 2222 2222 2', true]]);
    expect(run(cartao, 'cartão 4222-2222-2222-2')).toEqual([['4222-2222-2222-2', true]]);
  });
  it('4-4-4-1 sem Luhn válido não é cartão', () => {
    expect(run(cartao, 'cartão 4222 2222 2222 3')).toEqual([]);
  });
  it('espaços duplos entre os grupos', () => {
    expect(run(cartao, 'cartão 4111  1111  1111  1111')).toEqual([
      ['4111  1111  1111  1111', true],
    ]);
  });
  it('três espaços entre os grupos não formam cartão', () => {
    expect(run(cartao, 'cartão 4111   1111   1111   1111')).toEqual([]);
  });
});

describe('CNPJ com pontuação parcial', () => {
  it.each(['11222333/0001-81', '11.222.333000181', '11222333000181', '12.ABC.345/01DE35'])(
    '%s com DV válido é detectado',
    (partial) => {
      expect(run(cnpj, `ref ${partial}`)).toEqual([[partial, true]]);
    },
  );
  it.each(['11222333/0001-80', '11.222.333000180', '12.ABC.345/01DE36'])(
    '%s com DV inválido e sem contexto não é detectado',
    (partial) => {
      expect(run(cnpj, `ref ${partial}`)).toEqual([]);
    },
  );
  it('DV inválido com contexto é detectado (valid: false)', () => {
    expect(run(cnpj, 'CNPJ 11222333/0001-80')).toEqual([['11222333/0001-80', false]]);
    expect(run(cnpj, 'CNPJ 11.222.333000180')).toEqual([['11.222.333000180', false]]);
  });
  it('totalmente formatado continua aceito sem DV nem contexto', () => {
    expect(run(cnpj, 'ref 11.222.333/0001-80')).toEqual([['11.222.333/0001-80', false]]);
  });
  it('prosa próxima não é CNPJ: data, valor e processo', () => {
    expect(run(cnpj, 'em 14/10/2026 pagou R$ 1.234.567/0001 no processo 0001234-56.2026')).toEqual(
      [],
    );
  });
});

describe('CPF e PIS seguidos de ponto ou traço + dígitos', () => {
  it.each(['12345678901.50', '52998224725.50', '52998224725-3', '52998224725.5'])(
    '%s é parte de número maior, não CPF',
    (token) => {
      expect(run(cpf, `valor ${token}`)).toEqual([]);
    },
  );
  it('com contexto o CPF é mascarado mesmo seguido de ponto ou traço + dígitos', () => {
    expect(run(cpf, 'CPF 52998224725-3')).toEqual([['52998224725', true]]);
    expect(run(cpf, 'CPF 52998224725-2026')).toEqual([['52998224725', true]]);
    expect(run(cpf, 'CPF 52998224725.5')).toEqual([['52998224725', true]]);
    expect(run(cpf, 'CPF 12345678901.50')).toEqual([['12345678901', false]]);
  });
  it('fim de frase continua detectando: ponto ou traço sem dígito depois', () => {
    expect(run(cpf, 'meu CPF é 529.982.247-25.')).toEqual([['529.982.247-25', true]]);
    expect(run(cpf, 'pedido 52998224725.')).toEqual([['52998224725', true]]);
    expect(run(cpf, 'pedido 52998224725 - 3')).toEqual([['52998224725', true]]);
    expect(run(cpf, 'pedido 52998224725.\nPróximo')).toEqual([['52998224725', true]]);
  });
  it('CPF totalmente formatado vale mesmo com resto numérico depois (privacidade primeiro)', () => {
    expect(run(cpf, 'x 529.982.247-25.50')).toEqual([['529.982.247-25', true]]);
  });
  it.each(['12055445814.50', '12055445814-3'])('PIS: %s é parte de número maior', (token) => {
    expect(run(pis, `valor ${token}`)).toEqual([]);
  });
  it('PIS com contexto é mascarado mesmo seguido de ponto ou traço + dígitos', () => {
    expect(run(pis, 'PIS 12055445814.50')).toEqual([['12055445814', true]]);
    expect(run(pis, 'NIT 12055445815-2026')).toEqual([['12055445815', false]]);
  });
  it('PIS: fim de frase e formatado continuam detectados', () => {
    expect(run(pis, 'registro 12055445814.')).toEqual([['12055445814', true]]);
    expect(run(pis, 'PIS 120.55445.81-4.')).toEqual([['120.55445.81-4', true]]);
  });
});

describe('cartão colado com grupo anexo e limites do Luhn do conjunto', () => {
  it.each(['4111111111111111 123', '4111111111111111 1234', '4111111111111111-123'])(
    'o grupo anexo entra no trecho: %s',
    (text) => {
      expect(run(cartao, `cartão ${text}`)).toEqual([[text, true]]);
    },
  );
  it('colado + validade (2 dígitos) + CVV: só os 16 dígitos', () => {
    expect(run(cartao, '4111111111111111 12 28 123')).toEqual([['4111111111111111', true]]);
  });
  it('colado + palavra + ano não engole o ano', () => {
    expect(run(cartao, '4111111111111111 em 2026')).toEqual([['4111111111111111', true]]);
  });
  it('Luhn do conjunto só vale com 19 dígitos no total (nada de cartão de 17 ou 18)', () => {
    // Amex inválido (15 dígitos) + 3 dígitos = 18 dígitos que fecham no Luhn do conjunto.
    const extra = Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0')).find((e) =>
      isValidLuhn(`378282246310006${e}`),
    );
    expect(extra).toBeDefined();
    expect(run(cartao, `x 3782 822463 10006 ${extra ?? ''}`)).toEqual([]);
  });
});
