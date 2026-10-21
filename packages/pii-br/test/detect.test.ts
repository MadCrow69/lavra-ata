import { describe, expect, it } from 'vitest';
import { detect } from '../src/detect';

// Montados por código: o arquivo não carrega caracteres invisíveis nem ambíguos.
const HYPHEN = String.fromCharCode(0x2010);
const EN_DASH = String.fromCharCode(0x2013);
const NBSP = String.fromCharCode(0xa0);

describe('detect', () => {
  it('encontra vários tipos em ordem', () => {
    const t = 'Maria (CPF 529.982.247-25) fone (11) 98888-7777, e-mail maria@exemplo.com';
    expect(detect(t).map((f) => f.type)).toEqual(['CPF', 'TELEFONE', 'EMAIL']);
  });
  it('11 dígitos com DV de CPF válido viram CPF, não telefone', () => {
    expect(detect('número 52998224725').map((f) => f.type)).toEqual(['CPF']);
  });
  it('respeita options.types', () => {
    expect(
      detect('529.982.247-25 maria@exemplo.com', { types: ['EMAIL'] }).map((f) => f.type),
    ).toEqual(['EMAIL']);
  });
  it('falsos positivos clássicos', () => {
    const t =
      'Valor R$ 1.234.567,89; processo 0001234-56.2026.8.26.0100; às 14h30 de 14/10/2026; versão 2.3.4; ISO 9001; NR-5; item 3.2.';
    expect(detect(t)).toEqual([]);
  });
  it('texto vazio', () => {
    expect(detect('')).toEqual([]);
  });
  it('devolve posições e valor original', () => {
    const t = 'cpf 529.982.247-25 fim';
    expect(detect(t)).toEqual([
      { type: 'CPF', value: '529.982.247-25', start: 4, end: 18, valid: true },
    ]);
  });
  it('e-mail com dígitos não vira outro tipo', () => {
    expect(detect('escreva a 11988887777@exemplo.com hoje').map((f) => f.type)).toEqual(['EMAIL']);
  });
  it('é puro: chamadas repetidas dão o mesmo resultado', () => {
    const t = 'CPF 529.982.247-25 e maria@exemplo.com';
    expect(detect(t)).toEqual(detect(t));
  });
  it('saída sem sobreposição e ordenada', () => {
    const t = 'RG 12.345.678-9, CPF 529.982.247-25, CEP 01310-100, placa ABC1D23';
    const found = detect(t);
    for (let i = 1; i < found.length; i++) {
      expect(found[i]?.start).toBeGreaterThanOrEqual(found[i - 1]?.end ?? 0);
    }
    expect(found.length).toBeGreaterThanOrEqual(4);
  });
});

describe('detect: nova tentativa após candidato rejeitado (R1)', () => {
  it('um casamento largo rejeitado não engole o cartão real', () => {
    const found = detect('validade 2029 4111 1111 1111 1111');
    expect(found.map((f) => [f.type, f.value])).toEqual([['CARTAO', '4111 1111 1111 1111']]);
  });
});

describe('detect: separadores Unicode (R2)', () => {
  it('RG com hífen tipográfico (U+2010) inclui o DV e preserva o original', () => {
    const t = `rg 12.345.678${HYPHEN}9`;
    const found = detect(t);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'RG',
      value: `12.345.678${HYPHEN}9`,
      start: 3,
      end: t.length,
    });
  });
  it('RG com espaços sem quebra', () => {
    const t = `RG 12${NBSP}345${NBSP}678`;
    expect(detect(t).map((f) => [f.type, f.value])).toEqual([['RG', `12${NBSP}345${NBSP}678`]]);
  });
  it('CPF com meia-risca', () => {
    const t = `CPF 529.982.247${EN_DASH}25`;
    expect(detect(t).map((f) => [f.type, f.value])).toEqual([['CPF', `529.982.247${EN_DASH}25`]]);
  });
  it.each([0x2011, 0x2012, 0x2014, 0x2015, 0x2212])('traço código %i no CPF', (code) => {
    const dash = String.fromCharCode(code);
    expect(detect(`CPF 529.982.247${dash}25`).map((f) => f.type)).toEqual(['CPF']);
  });
  it.each([0x202f, 0x2007])('espaço código %i no RG', (code) => {
    const sp = String.fromCharCode(code);
    expect(detect(`RG 12${sp}345${sp}678`).map((f) => f.type)).toEqual(['RG']);
  });
});

describe('detect: cartão com hífen espaçado (R4)', () => {
  it('4111 - 1111 - 1111 - 1111', () => {
    expect(detect('cartão 4111 - 1111 - 1111 - 1111 ok').map((f) => [f.type, f.value])).toEqual([
      ['CARTAO', '4111 - 1111 - 1111 - 1111'],
    ]);
  });
});

describe('desempenho de detect: texto patológico de 50 mil caracteres', () => {
  const N = 50_000;
  const casos: Record<string, string> = {
    hifens: '-'.repeat(N),
    pontos: '.'.repeat(N),
    digitos: '1'.repeat(N),
    'a.': 'a.'.repeat(N / 2),
    espacos: ' '.repeat(N),
    'digito-espaco': '1 '.repeat(N / 2),
    'bloco-espaco': '2222 '.repeat(N / 5),
    'bloco-hifen': '22-'.repeat(N / 3),
    arrobas: 'a@'.repeat(N / 2),
    'arroba-ponto': 'a@a.'.repeat(N / 4),
    'ddd-parenteses': '(11) '.repeat(N / 5),
    'letra-digito': 'A1'.repeat(N / 2),
    'x-ponto': '1.'.repeat(N / 2),
    'rg-contexto': 'RG 1'.repeat(N / 4),
    'cartao-hifen-espacado': '4111 - '.repeat(N / 7),
  };
  const tempos: string[] = [];
  for (const [caso, texto] of Object.entries(casos)) {
    it(`${caso}: detect em < 1000 ms`, () => {
      const t0 = performance.now();
      detect(texto);
      const ms = performance.now() - t0;
      tempos.push(`detect/${caso}=${ms.toFixed(1)}ms`);
      expect(ms, `detect em ${caso}`).toBeLessThan(1000);
    });
  }
  it('registra os tempos', () => {
    console.info(tempos.join(String.fromCharCode(10)));
    expect(tempos.length).toBeGreaterThan(0);
  });
});
