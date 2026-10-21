import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, isValidLuhn, isValidPis } from '../src/check-digits';

describe('isValidCpf', () => {
  it('aceita CPF válido', () => {
    expect(isValidCpf('52998224725')).toBe(true);
  });
  it('rejeita DV errado', () => {
    expect(isValidCpf('52998224724')).toBe(false);
  });
  it('rejeita dígitos repetidos', () => {
    expect(isValidCpf('11111111111')).toBe(false);
  });
  it('rejeita tamanho errado', () => {
    expect(isValidCpf('5299822472')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita numérico', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });
  it('aceita alfanumérico (exemplo oficial da Receita)', () => {
    expect(isValidCnpj('12ABC34501DE35')).toBe(true);
  });
  it('rejeita DV errado', () => {
    expect(isValidCnpj('12ABC34501DE36')).toBe(false);
  });
  it('rejeita repetidos', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
  it('rejeita letra nos DV', () => {
    expect(isValidCnpj('12ABC34501DE3A')).toBe(false);
  });
});

describe('isValidPis', () => {
  it('aceita PIS válido', () => {
    expect(isValidPis('12055445814')).toBe(true);
  });
  it('rejeita DV errado', () => {
    expect(isValidPis('12055445815')).toBe(false);
  });
});

describe('isValidLuhn', () => {
  it('aceita cartão de teste', () => {
    expect(isValidLuhn('4111111111111111')).toBe(true);
  });
  it('rejeita soma errada', () => {
    expect(isValidLuhn('4111111111111112')).toBe(false);
  });
  it('rejeita menos de 13 dígitos', () => {
    expect(isValidLuhn('411111111111')).toBe(false);
  });
});
