import { describe, expect, it } from 'vitest';
import { contrasteWcag } from '../test/contraste';
import { tokenDe } from '../test/tokens';
import { COR_TEXTO_DOCUMENTO } from './documento';
import {
  CONTRASTE_MINIMO_DESTAQUE,
  DESTAQUES,
  DESTAQUE_PADRAO,
  corDoDestaque,
  ehIdDestaque,
} from './destaque';

describe('contrasteWcag', () => {
  it('preto sobre branco = 21', () => {
    expect(contrasteWcag('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});

describe('paleta de destaque', () => {
  it('ids únicos e rótulos na ordem combinada', () => {
    expect(new Set(DESTAQUES.map((d) => d.id)).size).toBe(DESTAQUES.length);
    expect(DESTAQUES.map((d) => d.rotulo)).toEqual([
      'Grafite (padrão)',
      'Azul-marinho',
      'Azul',
      'Verde-floresta',
      'Vinho',
      'Roxo',
    ]);
  });

  it('toda cor é #rrggbb minúsculo', () => {
    for (const d of DESTAQUES) expect(d.cor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('toda cor tem contraste mínimo sobre o branco da folha', () => {
    const folha = tokenDe('--cor-folha');
    expect(folha).toBeDefined();
    for (const d of DESTAQUES) {
      expect(contrasteWcag(d.cor, folha ?? ''), d.id).toBeGreaterThanOrEqual(
        CONTRASTE_MINIMO_DESTAQUE,
      );
    }
  });

  it('nenhuma cor repete a identidade do Lavra', () => {
    const identidade = [
      '--cor-primaria',
      '--cor-primaria-hover',
      '--cor-destaque',
      '--cor-destaque-texto',
      '--cor-destaque-fundo',
    ].map((nome) => {
      const valor = tokenDe(nome);
      expect(valor, nome).toBeDefined();
      return valor;
    });
    for (const d of DESTAQUES) expect(identidade, d.id).not.toContain(d.cor);
  });

  it('a cor do padrão é a tinta do documento', () => {
    expect(DESTAQUE_PADRAO).toBe('grafite');
    expect(corDoDestaque(DESTAQUE_PADRAO)).toBe(COR_TEXTO_DOCUMENTO);
  });

  it('id desconhecido cai na cor do padrão', () => {
    expect(corDoDestaque('rosa')).toBe(corDoDestaque(DESTAQUE_PADRAO));
    expect(corDoDestaque('vinho')).toBe('#7b1e3a');
  });

  it('ehIdDestaque aceita só ids', () => {
    expect(ehIdDestaque('vinho')).toBe(true);
    expect(ehIdDestaque('#7b1e3a')).toBe(false);
    expect(ehIdDestaque(undefined)).toBe(false);
  });
});
