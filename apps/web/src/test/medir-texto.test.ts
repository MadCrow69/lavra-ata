import { describe, expect, it } from 'vitest';
import { larguraPt } from './medir-texto';

describe('larguraPt', () => {
  it('soma os avanços: proporcional ao tamanho e aditiva', () => {
    const a = larguraPt('Nome', 10, false);
    expect(a).toBeGreaterThan(20);
    expect(a).toBeLessThan(40);
    expect(larguraPt('Nome', 20, false)).toBeCloseTo(2 * a, 10);
    expect(larguraPt('NomeNome', 10, false)).toBeCloseTo(2 * a, 10);
    expect(larguraPt('', 10, false)).toBe(0);
  });

  it('o negrito é mais largo que o regular', () => {
    expect(larguraPt('Presença', 9.5, true)).toBeGreaterThan(larguraPt('Presença', 9.5, false));
  });

  it('o espaço do Inter mede 576/2048 em', () => {
    expect(larguraPt(' ', 2048, false)).toBe(576);
  });

  it('caractere sem métrica lança, dizendo qual', () => {
    expect(() => larguraPt('漢', 10, false)).toThrow(/U\+6F22/);
    expect(() => larguraPt('a漢', 10, true)).toThrow(/U\+6F22/);
  });
});
