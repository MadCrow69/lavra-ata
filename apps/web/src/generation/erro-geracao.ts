import { ErroCadeia, ErroProvedor } from '../ai/errors';
import { ROTULO_PROVEDOR } from '../config/models';

/** Erro de geração como causa + ação, pronto para exibir. */
export interface ErroDeGeracao {
  titulo: string;
  detalhes: string[];
}

/**
 * Erro de uma geração (ata inteira ou uma seção) em pt-BR, sem nunca repassar texto que não foi
 * escrito por nós (chave, dados). `alvo` completa as frases: "a ata", "a seção".
 */
export function descreverErroDeGeracao(e: unknown, alvo: 'ata' | 'seção'): ErroDeGeracao {
  if (e instanceof ErroCadeia) {
    return e.falhas.length === 0
      ? { titulo: e.message, detalhes: [] }
      : {
          titulo: `Nenhum provedor conseguiu gerar a ${alvo}.`,
          detalhes: e.falhas.map((f) => `${ROTULO_PROVEDOR[f.provedor]}: ${f.mensagem}`),
        };
  }
  if (e instanceof ErroProvedor) {
    return { titulo: `A ${alvo} não foi gerada.`, detalhes: [e.message] };
  }
  return {
    titulo: `A ${alvo} não foi gerada por um erro inesperado no aplicativo.`,
    detalhes: [
      'Tente de novo. Se o erro continuar, troque de provedor nas configurações de chave.',
    ],
  };
}
