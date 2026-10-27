import { describe, expect, it } from 'vitest';
import type { ProviderConfig } from '../ai/types';
import { destinoDe, motivoParaRevisar } from './autorizacao';

const OPENAI: ProviderConfig = { id: 'openai', modelo: 'gpt-6-luna', chave: 'sk-teste-ficticia' };
const GEMINI: ProviderConfig = { id: 'gemini', modelo: 'gemini-3.8-flash', chave: 'AIzaTeste' };

describe('motivoParaRevisar', () => {
  const autorizado = { base: 'base', destinos: [OPENAI, GEMINI].map(destinoDe) };

  it('sem autorização nesta sessão: primeira revisão', () => {
    expect(motivoParaRevisar(null, 'base', [OPENAI])).toBe('primeira');
  });

  it('mesma base e fila igual ou menor: sai direto', () => {
    expect(motivoParaRevisar(autorizado, 'base', [OPENAI, GEMINI])).toBeNull();
    expect(motivoParaRevisar(autorizado, 'base', [GEMINI])).toBeNull();
  });

  it('base diferente: o conteúdo mudou', () => {
    expect(motivoParaRevisar(autorizado, 'base editada', [OPENAI])).toBe('conteudo');
  });

  it('provedor ou modelo novo na fila: destino não autorizado', () => {
    expect(motivoParaRevisar(autorizado, 'base', [{ ...OPENAI, modelo: 'gpt-6-sol' }])).toBe(
      'destino',
    );
    expect(
      motivoParaRevisar(autorizado, 'base', [
        { id: 'anthropic', modelo: 'claude-haiku-5-5', chave: 'x' },
      ]),
    ).toBe('destino');
  });
});
