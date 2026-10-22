import { describe, expect, it } from 'vitest';
import { MODELO_ID_MAX, MSG_ID_PARECE_CHAVE, erroDoIdDeModelo } from './models';

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
