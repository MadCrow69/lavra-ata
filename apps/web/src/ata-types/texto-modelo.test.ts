import { describe, expect, it } from 'vitest';
import { prazoOuNulo } from './texto-modelo';

describe('prazoOuNulo', () => {
  it('data AAAA-MM-DD válida vira dd/mm/aaaa', () => {
    expect(prazoOuNulo('2026-10-30')).toBe('30/10/2026');
    expect(prazoOuNulo(' 2026-10-30 ')).toBe('30/10/2026');
  });

  it('qualquer outro texto é mantido, aparado (inclusive o que só parece data)', () => {
    expect(prazoOuNulo('próxima reunião')).toBe('próxima reunião');
    expect(prazoOuNulo('  2026-02-30 ')).toBe('2026-02-30');
    expect(prazoOuNulo('30/10/2026')).toBe('30/10/2026');
  });

  it('vazio ou só espaços → null (quem chama decide entre traço e omissão)', () => {
    expect(prazoOuNulo('')).toBeNull();
    expect(prazoOuNulo('   ')).toBeNull();
  });
});
