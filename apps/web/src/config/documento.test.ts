import { describe, expect, it } from 'vitest';
import { tokenDe } from '../test/tokens';
import { COR_FUNDO_PREENCHER, COR_TEXTO_DOCUMENTO } from './documento';

describe('cores do documento exportado reproduzem a folha', () => {
  it('fundo da lacuna [PREENCHER] = --cor-folha-lacuna-fundo', () => {
    expect(tokenDe('--cor-folha-lacuna-fundo')).toBeDefined();
    expect(COR_FUNDO_PREENCHER).toBe(tokenDe('--cor-folha-lacuna-fundo'));
  });

  it('texto = --cor-folha-tinta', () => {
    expect(tokenDe('--cor-folha-tinta')).toBeDefined();
    expect(COR_TEXTO_DOCUMENTO).toBe(tokenDe('--cor-folha-tinta'));
  });
});
