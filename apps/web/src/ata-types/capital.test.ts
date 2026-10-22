import { describe, expect, it } from 'vitest';
import type { Participante, Presenca } from '../domain/draft';
import {
  formatarPercentual,
  formatarQuotas,
  lerPercentual,
  lerQuotas,
  quotasParaCentesimos,
  resumirCapital,
  textoCapitalPresente,
} from './capital';

function socio(id: string, participacao: string, presenca: Presenca = 'presente'): Participante {
  return {
    id,
    nome: `Sócio ${id}`,
    papel: '',
    presenca,
    justificativa: '',
    extras: { participacao },
  };
}

const PERCENTUAL = { modo_capital: 'percentual' };
const quotas = (total: string) => ({ modo_capital: 'quotas', total_quotas: total });

describe('lerPercentual (centésimos de ponto percentual)', () => {
  it.each([
    ['33,33', 3333],
    ['33.33', 3333],
    ['25 %', 2500],
    ['25%', 2500],
    ['100', 10000],
    ['0', 0],
    ['33,3', 3330],
    [' 12,5 ', 1250],
  ])('%s → %i', (texto, esperado) => {
    expect(lerPercentual(texto)).toBe(esperado);
  });

  it.each(['', '   ', '-5', '100,01', '101', '33,333', '1.000', 'abc', '12a', '%', ',5', '5,'])(
    '%j → null',
    (texto) => {
      expect(lerPercentual(texto)).toBeNull();
    },
  );
});

describe('lerQuotas (inteiro positivo)', () => {
  it.each([
    ['1.000', 1000],
    ['1000', 1000],
    ['1', 1],
    ['1.000.000', 1000000],
    [' 750 ', 750],
  ])('%s → %i', (texto, esperado) => {
    expect(lerQuotas(texto)).toBe(esperado);
  });

  it.each(['', '0', '1,5', '-3', '1.00', '1.0000', 'abc', '10 quotas', '99999999999999999999'])(
    '%j → null',
    (texto) => {
      expect(lerQuotas(texto)).toBeNull();
    },
  );
});

describe('formatação', () => {
  it('percentual sem casas decimais desnecessárias', () => {
    expect(formatarPercentual(7500)).toBe('75%');
    expect(formatarPercentual(3330)).toBe('33,3%');
    expect(formatarPercentual(3333)).toBe('33,33%');
    expect(formatarPercentual(5)).toBe('0,05%');
    expect(formatarPercentual(11000)).toBe('110%');
  });

  it('quotas com separador de milhar', () => {
    expect(formatarQuotas(1000)).toBe('1.000');
    expect(formatarQuotas(750)).toBe('750');
    expect(formatarQuotas(1234567)).toBe('1.234.567');
  });
});

describe('quotasParaCentesimos (arredonda meio para cima)', () => {
  it('1 de 3 → 3333; 2 de 3 → 6667; 3 de 3 → 10000', () => {
    expect(quotasParaCentesimos(1, 3)).toBe(3333);
    expect(quotasParaCentesimos(2, 3)).toBe(6667);
    expect(quotasParaCentesimos(3, 3)).toBe(10000);
  });

  it('meio exato sobe; números grandes sem perder precisão', () => {
    expect(quotasParaCentesimos(1, 20000)).toBe(1);
    expect(quotasParaCentesimos(750, 1000)).toBe(7500);
    expect(quotasParaCentesimos(9007199254740991, 9007199254740991)).toBe(10000);
  });
});

describe('resumirCapital em percentual', () => {
  it('50/30/20 com o de 20 ausente → presente 8000, soma 10000', () => {
    const r = resumirCapital(PERCENTUAL, [
      socio('a', '50'),
      socio('b', '30'),
      socio('c', '20', 'ausente'),
    ]);
    expect(r).toEqual({
      modo: 'percentual',
      presente: 8000,
      somaTodos: 10000,
      totalQuotas: null,
      presenteQuotas: null,
    });
    expect(textoCapitalPresente(r)).toBe('80%');
  });

  it('60/30/20 → soma 11000 e presente null (acima de 100%)', () => {
    const r = resumirCapital(PERCENTUAL, [socio('a', '60'), socio('b', '30'), socio('c', '20')]);
    expect(r.somaTodos).toBe(11000);
    expect(r.presente).toBeNull();
    expect(textoCapitalPresente(r)).toBeNull();
  });

  it('33,33 × 3 → soma 9999 (não vira 100)', () => {
    const r = resumirCapital(PERCENTUAL, [
      socio('a', '33,33'),
      socio('b', '33,33'),
      socio('c', '33,33'),
    ]);
    expect(r.somaTodos).toBe(9999);
    expect(r.presente).toBe(9999);
    expect(textoCapitalPresente(r)).toBe('99,99%');
  });

  it('participante com nome em branco é ignorado', () => {
    const r = resumirCapital(PERCENTUAL, [
      socio('a', '75'),
      { ...socio('b', '60'), nome: '  ' },
      socio('c', '25', 'justificado'),
    ]);
    expect(r.somaTodos).toBe(10000);
    expect(r.presente).toBe(7500);
  });

  it('presente sem valor válido → presente e soma null', () => {
    const r = resumirCapital(PERCENTUAL, [socio('a', '33,333'), socio('b', '50')]);
    expect(r.presente).toBeNull();
    expect(r.somaTodos).toBeNull();
  });

  it('ausente com valor inválido: soma desconhecida, então presente também é null', () => {
    const r = resumirCapital(PERCENTUAL, [socio('a', '50'), socio('b', 'abc', 'ausente')]);
    expect(r.somaTodos).toBeNull();
    expect(r.presente).toBeNull();
  });

  it('lista vazia: nada informado; ninguém presente: presente null (nunca "0%")', () => {
    const vazia = resumirCapital(PERCENTUAL, []);
    expect([vazia.presente, vazia.somaTodos]).toEqual([null, null]);
    const ausentes = resumirCapital(PERCENTUAL, [socio('a', '100', 'ausente')]);
    expect([ausentes.presente, ausentes.somaTodos]).toEqual([null, 10000]);
    expect(resumirCapital(quotas('10'), [socio('a', '10', 'justificado')]).presente).toBeNull();
  });

  it('sem modo escolhido, lê como percentual', () => {
    expect(resumirCapital({}, [socio('a', '100')]).modo).toBe('percentual');
  });
});

describe('resumirCapital em quotas', () => {
  it('500/300/200 de 1.000 com 200 ausente → "800 de 1.000 quotas (80%)"', () => {
    const r = resumirCapital(quotas('1.000'), [
      socio('a', '500'),
      socio('b', '300'),
      socio('c', '200', 'ausente'),
    ]);
    expect(r).toEqual({
      modo: 'quotas',
      presente: 8000,
      somaTodos: 1000,
      totalQuotas: 1000,
      presenteQuotas: 800,
    });
    expect(textoCapitalPresente(r)).toBe('800 de 1.000 quotas (80%)');
  });

  it('1/1/1 de 3, todos presentes → 10000 ("100%", nunca 9999)', () => {
    const r = resumirCapital(quotas('3'), [socio('a', '1'), socio('b', '1'), socio('c', '1')]);
    expect(r.presente).toBe(10000);
    expect(textoCapitalPresente(r)).toBe('3 de 3 quotas (100%)');
  });

  it('1/1/1 de 3 com dois presentes → 6667', () => {
    const r = resumirCapital(quotas('3'), [
      socio('a', '1'),
      socio('b', '1'),
      socio('c', '1', 'ausente'),
    ]);
    expect(r.presente).toBe(6667);
    expect(r.presenteQuotas).toBe(2);
  });

  it('total inválido ou vazio → presente null', () => {
    for (const total of ['', '0', '1,5', 'mil']) {
      const r = resumirCapital(quotas(total), [socio('a', '1')]);
      expect(r.totalQuotas).toBeNull();
      expect(r.presente).toBeNull();
      expect(r.somaTodos).toBe(1);
    }
  });

  it('soma acima do total → presente null', () => {
    const r = resumirCapital(quotas('1.000'), [socio('a', '600'), socio('b', '500')]);
    expect(r.somaTodos).toBe(1100);
    expect(r.presente).toBeNull();
  });

  it('valor de quotas inválido ("1,5") → soma e presente null', () => {
    const r = resumirCapital(quotas('10'), [socio('a', '1,5'), socio('b', '5')]);
    expect(r.somaTodos).toBeNull();
    expect(r.presente).toBeNull();
  });
});
