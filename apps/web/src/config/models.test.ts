import { describe, expect, it } from 'vitest';
import {
  CHAVE_MIN_PARA_CONFERIR,
  MODELO_ID_MAX,
  MSG_ID_PARECE_CHAVE,
  erroDoIdDeModelo,
  erroDoIdDeModeloComChave,
} from './models';

describe('erroDoIdDeModelo', () => {
  it.each(['gpt-6-luna', 'gemini-3.8-flash', 'claude-haiku-5-5', 'org/modelo:v1_2', ' gpt-6 ', ''])(
    'aceita "%s"',
    (id) => {
      expect(erroDoIdDeModelo(id)).toBeNull();
    },
  );

  it.each(['sk-proj-abc123', 'SK-abc', 'AIzaSyTesteFicticia', 'aiza-minusculo'])(
    'recusa o que parece chave de API: %s',
    (id) => {
      expect(erroDoIdDeModelo(id)).toBe(MSG_ID_PARECE_CHAVE);
    },
  );

  it('recusa acima do limite de tamanho, com causa e ação', () => {
    const erro = erroDoIdDeModelo('m'.repeat(MODELO_ID_MAX + 1));
    expect(erro).toContain(String(MODELO_ID_MAX));
    expect(erro).toContain('Confira');
  });

  it.each(['meu modelo', 'modelo<x>', 'modelo"', 'ação'])(
    'recusa caractere fora da lista: %s',
    (id) => {
      expect(erroDoIdDeModelo(id)).toContain('Remova');
    },
  );
});

describe('erroDoIdDeModeloComChave', () => {
  const chave = 'x'.repeat(CHAVE_MIN_PARA_CONFERIR);

  it('recusa o id que contém a chave do cartão (a partir do tamanho mínimo)', () => {
    expect(erroDoIdDeModeloComChave(`modelo-${chave}`, chave)).toBe(MSG_ID_PARECE_CHAVE);
    expect(erroDoIdDeModeloComChave(`modelo-${chave}`, `  ${chave} `)).toBe(MSG_ID_PARECE_CHAVE);
  });

  it('chave mais curta que o mínimo não é procurada no id', () => {
    const curta = 'x'.repeat(CHAVE_MIN_PARA_CONFERIR - 1);
    expect(erroDoIdDeModeloComChave(`modelo-${curta}`, curta)).toBeNull();
  });

  it('sem chave, ou com id sem a chave, vale só a regra do id', () => {
    expect(erroDoIdDeModeloComChave('gpt-6-luna', '')).toBeNull();
    expect(erroDoIdDeModeloComChave('gpt-6-luna', chave)).toBeNull();
    expect(erroDoIdDeModeloComChave('meu modelo', chave)).toContain('Remova');
  });
});
