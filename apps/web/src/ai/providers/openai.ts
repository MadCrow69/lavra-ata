import { MODELOS, ROTULO_PROVEDOR, esforcoDoModelo } from '../../config/models';
import { erroProvedor } from '../errors';
import type { ProviderAdapter } from '../types';
import { chamarProvedor, comoLista, ehRegistro, interpretarSaida } from './comum';

const BASE = 'https://api.openai.com/v1';

/**
 * Responses API (`POST /v1/responses`) com saída estruturada estrita e `store: false`.
 * Referência: https://platform.openai.com/docs/api-reference/responses
 */
export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  rotulo: ROTULO_PROVEDOR.openai,

  async gerar(cfg, req) {
    const esforco = esforcoDoModelo('openai', cfg.modelo);
    const resposta = await chamarProvedor({
      provedor: 'openai',
      chave: cfg.chave,
      modelo: cfg.modelo,
      url: `${BASE}/responses`,
      metodo: 'POST',
      headers: { Authorization: `Bearer ${cfg.chave}`, 'Content-Type': 'application/json' },
      corpo: {
        model: cfg.modelo,
        input: [
          { role: 'system', content: req.sistema },
          { role: 'user', content: req.usuario },
        ],
        store: false,
        max_output_tokens: MODELOS.openai.maxSaida,
        ...(esforco === undefined ? {} : { reasoning: { effort: esforco } }),
        text: {
          format: { type: 'json_schema', name: req.nomeSchema, strict: true, schema: req.schema },
        },
      },
      signal: req.signal,
    });

    const corpo = ehRegistro(resposta) ? resposta : {};
    if (corpo.status === 'incomplete') {
      const detalhes = ehRegistro(corpo.incomplete_details) ? corpo.incomplete_details : {};
      throw erroProvedor(detalhes.reason === 'content_filter' ? 'recusa' : 'cortado', 'openai');
    }
    if (corpo.status === 'failed') throw erroProvedor('instavel', 'openai', { repetivel: false });

    const textos: string[] = [];
    for (const item of comoLista(corpo.output)) {
      if (!ehRegistro(item) || item.type !== 'message') continue;
      for (const parte of comoLista(item.content)) {
        if (!ehRegistro(parte)) continue;
        if (parte.type === 'refusal') throw erroProvedor('recusa', 'openai');
        if (parte.type === 'output_text' && typeof parte.text === 'string') textos.push(parte.text);
      }
    }
    return interpretarSaida(textos.join(''), req.schema, 'openai');
  },

  async testarChave(cfg, signal) {
    await chamarProvedor({
      provedor: 'openai',
      chave: cfg.chave,
      url: `${BASE}/models`,
      metodo: 'GET',
      headers: { Authorization: `Bearer ${cfg.chave}` },
      signal,
    });
  },
};
