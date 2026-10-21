import { MODELOS, ROTULO_PROVEDOR, esforcoDoModelo } from '../../config/models';
import { erroProvedor } from '../errors';
import type { ProviderAdapter } from '../types';
import { chamarProvedor, comoLista, ehRegistro, interpretarSaida } from './comum';

const BASE = 'https://api.anthropic.com/v1';

function cabecalhos(chave: string): Record<string, string> {
  return {
    'x-api-key': chave,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/** Motivos de término em que a resposta ficou incompleta por falta de espaço. */
const FINALIZACAO_CORTADA = new Set(['max_tokens', 'model_context_window_exceeded']);

/**
 * Messages API com `output_config.format` (JSON Schema) e `effort` por modelo. Não envia
 * `thinking`, `temperature`, `top_p`, `top_k`, prefill nem `fallbacks`: o Haiku 5.5 os rejeita.
 * Referência: https://docs.anthropic.com/en/api/messages
 */
export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  rotulo: ROTULO_PROVEDOR.anthropic,

  async gerar(cfg, req) {
    const esforco = esforcoDoModelo('anthropic', cfg.modelo);
    const resposta = await chamarProvedor({
      provedor: 'anthropic',
      chave: cfg.chave,
      modelo: cfg.modelo,
      url: `${BASE}/messages`,
      metodo: 'POST',
      headers: { ...cabecalhos(cfg.chave), 'Content-Type': 'application/json' },
      corpo: {
        model: cfg.modelo,
        max_tokens: MODELOS.anthropic.maxSaida,
        system: req.sistema,
        messages: [{ role: 'user', content: req.usuario }],
        output_config: {
          format: { type: 'json_schema', schema: req.schema },
          ...(esforco === undefined ? {} : { effort: esforco }),
        },
      },
      signal: req.signal,
    });

    const corpo = ehRegistro(resposta) ? resposta : {};
    const motivo = typeof corpo.stop_reason === 'string' ? corpo.stop_reason : 'end_turn';
    if (FINALIZACAO_CORTADA.has(motivo)) throw erroProvedor('cortado', 'anthropic');
    if (motivo === 'refusal') throw erroProvedor('recusa', 'anthropic');
    if (motivo !== 'end_turn' && motivo !== 'stop_sequence')
      throw erroProvedor('instavel', 'anthropic', { repetivel: false });

    // O conteúdo pode começar por blocos `thinking`: lê só os blocos `text`.
    const textos: string[] = [];
    for (const bloco of comoLista(corpo.content)) {
      if (ehRegistro(bloco) && bloco.type === 'text' && typeof bloco.text === 'string') {
        textos.push(bloco.text);
      }
    }
    return interpretarSaida(textos.join(''), req.schema, 'anthropic');
  },

  async testarChave(cfg, signal) {
    await chamarProvedor({
      provedor: 'anthropic',
      chave: cfg.chave,
      url: `${BASE}/models`,
      metodo: 'GET',
      headers: cabecalhos(cfg.chave),
      signal,
    });
  },
};
