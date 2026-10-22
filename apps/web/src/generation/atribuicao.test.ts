import { describe, expect, it } from 'vitest';
import { resumoDoErro } from '../ai/errors';
import { textoDaFalha, textoDeGeracao } from './atribuicao';

describe('resumo da chave recusada pelo motivo', () => {
  it('sem motivo: "chave recusada"; com motivo, o motivo de cada provedor', () => {
    expect(resumoDoErro('chave_invalida')).toBe('chave recusada');
    expect(resumoDoErro('chave_invalida', 'sem_credito')).toBe('sem crédito');
    expect(resumoDoErro('chave_invalida', 'sem_workspace')).toBe('chave sem workspace');
    expect(resumoDoErro('limite', 'sem_credito')).toBe('limite de uso');
  });

  it('a linha de autoria diz o motivo de cada provedor que falhou', () => {
    expect(
      textoDeGeracao({
        provedor: 'gemini',
        modelo: 'gemini-3.8-flash',
        falhas: [
          { provedor: 'anthropic', erro: 'chave_invalida', motivo: 'sem_workspace' },
          { provedor: 'openai', erro: 'chave_invalida', motivo: 'sem_credito' },
        ],
      }),
    ).toBe(
      'Gerado por Gemini · gemini-3.8-flash — Anthropic falhou (chave sem workspace); OpenAI falhou (sem crédito)',
    );
    expect(textoDaFalha({ provedor: 'openai', erro: 'chave_invalida' })).toBe(
      'OpenAI falhou (chave recusada)',
    );
  });
});
