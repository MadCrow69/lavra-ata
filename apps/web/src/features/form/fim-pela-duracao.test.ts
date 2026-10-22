import { describe, expect, it } from 'vitest';
import { minutosDaDuracao, sugerirFim, textoDaSugestaoDoFim } from './fim-pela-duracao';

describe('minutosDaDuracao', () => {
  it('arredonda para o minuto mais próximo; menos de meio minuto não conta', () => {
    expect(minutosDaDuracao((72 * 60 + 29) * 1000)).toBe(72);
    expect(minutosDaDuracao((72 * 60 + 30) * 1000)).toBe(73);
    expect(minutosDaDuracao(29_999)).toBeNull();
    expect(minutosDaDuracao(null)).toBeNull();
  });
});

describe('sugerirFim', () => {
  it('início preenchido e término vazio: sugere início + duração', () => {
    expect(sugerirFim(72, '14:00', '')).toEqual({
      tipo: 'preencher',
      duracao: '1h12',
      inicio: '14h',
      fim: '15:12',
    });
    expect(sugerirFim(72, '14:00', undefined)?.tipo).toBe('preencher');
  });

  it('término já preenchido: nunca sugere (não sobrescreve)', () => {
    expect(sugerirFim(72, '14:00', '16:00')).toBeNull();
    expect(sugerirFim(72, '', '16:00')).toBeNull();
  });

  it('sem duração (transcrição colada ou .txt): nada a sugerir', () => {
    expect(sugerirFim(null, '14:00', '')).toBeNull();
  });

  it('início vazio ou inválido: pede o início', () => {
    expect(sugerirFim(72, '', '')).toEqual({ tipo: 'semInicio', duracao: '1h12' });
    expect(sugerirFim(72, undefined, '')).toEqual({ tipo: 'semInicio', duracao: '1h12' });
    expect(sugerirFim(72, '25:00', '')).toEqual({ tipo: 'semInicio', duracao: '1h12' });
  });

  it('passaria de 23:59: não sugere e diz por quê', () => {
    expect(sugerirFim(90, '22:30', '')).toEqual({
      tipo: 'passaDaMeiaNoite',
      duracao: '1h30',
      inicio: '22h30',
    });
  });
});

describe('textoDaSugestaoDoFim', () => {
  it('cada caso tem causa e ação, em pt-BR', () => {
    expect(
      textoDaSugestaoDoFim({ tipo: 'preencher', duracao: '1h12', inicio: '14h', fim: '15:12' }),
    ).toBe('A transcrição dura 1h12.');
    expect(textoDaSugestaoDoFim({ tipo: 'semInicio', duracao: '1h12' })).toBe(
      'A transcrição dura 1h12 — preencha o início para sugerirmos o término.',
    );
    expect(
      textoDaSugestaoDoFim({ tipo: 'passaDaMeiaNoite', duracao: '1h30', inicio: '22h30' }),
    ).toBe(
      'A transcrição dura 1h30: somada ao início (22h30), passaria da meia-noite. Preencha o término à mão.',
    );
  });
});
