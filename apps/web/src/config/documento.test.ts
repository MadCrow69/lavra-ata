import { describe, expect, it } from 'vitest';
import tokens from '../styles/tokens.css?raw';
import { COR_FUNDO_PREENCHER, COR_TEXTO_DOCUMENTO } from './documento';

function token(nome: string): string | undefined {
  return new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokens)?.[1]?.toLowerCase();
}

describe('cores do documento exportado reproduzem a folha', () => {
  it('fundo da lacuna [PREENCHER] = --cor-folha-lacuna-fundo', () => {
    expect(token('--cor-folha-lacuna-fundo')).toBeDefined();
    expect(COR_FUNDO_PREENCHER).toBe(token('--cor-folha-lacuna-fundo'));
  });

  it('texto = --cor-folha-tinta', () => {
    expect(token('--cor-folha-tinta')).toBeDefined();
    expect(COR_TEXTO_DOCUMENTO).toBe(token('--cor-folha-tinta'));
  });
});
