import { describe, expect, it } from 'vitest';
import { LIMITE_PARTICIPANTES } from '../config/limits';
import { calcularAdicao } from './participantes';

describe('calcularAdicao', () => {
  it('cabe tudo: nada é ignorado', () => {
    expect(calcularAdicao(10, 5)).toEqual({ adicionados: 5, ignorados: 0 });
  });

  it('passa do limite: o excedente é ignorado', () => {
    expect(calcularAdicao(LIMITE_PARTICIPANTES - 2, 5)).toEqual({ adicionados: 2, ignorados: 3 });
  });

  it('lista cheia: ninguém entra', () => {
    expect(calcularAdicao(LIMITE_PARTICIPANTES, 4)).toEqual({ adicionados: 0, ignorados: 4 });
  });

  it('nada solicitado: nada muda', () => {
    expect(calcularAdicao(3, 0)).toEqual({ adicionados: 0, ignorados: 0 });
  });
});
