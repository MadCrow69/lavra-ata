import { describe, expect, it } from 'vitest';
import {
  formatarData,
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  somarMinutos,
} from './dates';
import fonteDates from './dates.ts?raw';

describe('formatarData', () => {
  it('converte AAAA-MM-DD em DD/MM/AAAA por fatiamento', () => {
    expect(formatarData('2026-10-14')).toBe('14/10/2026');
    expect(formatarData('2024-02-29')).toBe('29/02/2024');
  });

  it('rejeita data inexistente ou fora do formato', () => {
    expect(() => formatarData('2026-02-29')).toThrow(RangeError);
    expect(() => formatarData('14/10/2026')).toThrow(RangeError);
    expect(() => formatarData('')).toThrow(RangeError);
  });
});

describe('formatarDataPorExtenso', () => {
  it('escreve a data por extenso', () => {
    expect(formatarDataPorExtenso('2026-10-14')).toBe(
      'Aos catorze dias do mês de outubro de dois mil e vinte e seis',
    );
  });

  it('usa "Ao primeiro dia" no dia 1', () => {
    expect(formatarDataPorExtenso('2026-10-01')).toBe(
      'Ao primeiro dia do mês de outubro de dois mil e vinte e seis',
    );
  });

  it.each([
    ['2026-03-02', 'Aos dois dias do mês de março de dois mil e vinte e seis'],
    ['2026-03-21', 'Aos vinte e um dias do mês de março de dois mil e vinte e seis'],
    ['2026-03-30', 'Aos trinta dias do mês de março de dois mil e vinte e seis'],
    ['2026-12-31', 'Aos trinta e um dias do mês de dezembro de dois mil e vinte e seis'],
    ['2026-01-10', 'Aos dez dias do mês de janeiro de dois mil e vinte e seis'],
  ])('dias: %s', (iso, esperado) => {
    expect(formatarDataPorExtenso(iso)).toBe(esperado);
  });

  it.each([
    ['1900-05-10', 'mil e novecentos'],
    ['1901-05-10', 'mil novecentos e um'],
    ['1999-05-10', 'mil novecentos e noventa e nove'],
    ['2000-05-10', 'dois mil'],
    ['2001-05-10', 'dois mil e um'],
    ['2010-05-10', 'dois mil e dez'],
    ['2026-05-10', 'dois mil e vinte e seis'],
    ['2100-05-10', 'dois mil e cem'],
    ['2101-05-10', 'dois mil cento e um'],
    ['2110-05-10', 'dois mil cento e dez'],
    ['2199-05-10', 'dois mil cento e noventa e nove'],
  ])('anos: %s', (iso, ano) => {
    expect(formatarDataPorExtenso(iso)).toBe(`Aos dez dias do mês de maio de ${ano}`);
  });

  it('nomeia os doze meses', () => {
    const meses = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];
    meses.forEach((mes, i) => {
      const mm = String(i + 1).padStart(2, '0');
      expect(formatarDataPorExtenso(`2026-${mm}-05`)).toContain(`do mês de ${mes} de `);
    });
  });

  it('aceita 29/02 só em ano bissexto', () => {
    expect(formatarDataPorExtenso('2024-02-29')).toContain('vinte e nove dias do mês de fevereiro');
    expect(formatarDataPorExtenso('2000-02-29')).toContain('vinte e nove dias');
    expect(() => formatarDataPorExtenso('2026-02-29')).toThrow(RangeError);
    expect(() => formatarDataPorExtenso('2100-02-29')).toThrow(RangeError);
  });

  it('lança RangeError em pt-BR para data inválida', () => {
    for (const ruim of ['2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '']) {
      expect(() => formatarDataPorExtenso(ruim)).toThrow(RangeError);
    }
    expect(() => formatarDataPorExtenso('2026-02-29')).toThrow(/data inválida/i);
  });

  it('lança RangeError fora de 1900–2199', () => {
    expect(() => formatarDataPorExtenso('1899-12-31')).toThrow(RangeError);
    expect(() => formatarDataPorExtenso('2200-01-01')).toThrow(RangeError);
  });

  it('garantia estrutural: dates.ts não usa Date (bug de fuso)', () => {
    expect(fonteDates).not.toMatch(/\bnew\s+Date\b/);
    expect(fonteDates).not.toMatch(/\bDate\s*\(/);
    expect(fonteDates).not.toMatch(/\bDate\.(parse|UTC|now)\b/);
  });
});

describe('formatarHora', () => {
  it.each([
    ['14:30', '14h30'],
    ['09:00', '9h'],
    ['09:05', '9h05'],
    ['00:00', '0h'],
    ['23:59', '23h59'],
    ['12:00', '12h'],
  ])('%s → %s', (entrada, esperado) => {
    expect(formatarHora(entrada)).toBe(esperado);
  });

  it('lança RangeError para hora inválida', () => {
    for (const ruim of ['24:00', '12:60', '9:00', '', '12h30']) {
      expect(() => formatarHora(ruim)).toThrow(RangeError);
    }
  });
});

describe('somarMinutos', () => {
  it.each([
    ['14:00', 72, '15:12'],
    ['09:50', 15, '10:05'],
    ['00:00', 0, '00:00'],
    ['22:30', 89, '23:59'],
  ])('%s + %i min → %s', (inicio, minutos, esperado) => {
    expect(somarMinutos(inicio, minutos)).toBe(esperado);
  });

  it('passar de 23:59 devolve null (não vira o dia seguinte)', () => {
    expect(somarMinutos('22:30', 90)).toBeNull();
    expect(somarMinutos('23:59', 1)).toBeNull();
  });

  it('hora inválida ou minutos negativos/fracionados lançam RangeError', () => {
    expect(() => somarMinutos('24:00', 1)).toThrow(RangeError);
    expect(() => somarMinutos('', 1)).toThrow(RangeError);
    expect(() => somarMinutos('10:00', -1)).toThrow(RangeError);
    expect(() => somarMinutos('10:00', 1.5)).toThrow(RangeError);
  });
});

describe('formatarDuracao', () => {
  it.each([
    [72, '1h12'],
    [60, '1h'],
    [125, '2h05'],
    [45, '45 min'],
    [1, '1 min'],
    [1500, '25h'],
  ])('%i min → %s', (minutos, esperado) => {
    expect(formatarDuracao(minutos)).toBe(esperado);
  });

  it('zero, negativo ou fracionado lança RangeError', () => {
    for (const ruim of [0, -5, 1.5, Number.NaN]) {
      expect(() => formatarDuracao(ruim)).toThrow(RangeError);
    }
  });
});
