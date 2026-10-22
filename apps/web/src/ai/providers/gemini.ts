import { MODELOS, ORIGEM_PROVEDOR, ROTULO_PROVEDOR } from '../../config/models';
import { erroProvedor } from '../errors';
import type { ProviderAdapter } from '../types';
import { chamarProvedor, comoLista, ehRegistro, interpretarSaida } from './comum';

const BASE = `${ORIGEM_PROVEDOR.gemini}/v1beta`;

/** Motivos de término em que o Gemini deliberadamente não entrega a resposta. */
const FINALIZACAO_RECUSA = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
]);

/**
 * `generateContent` com `responseMimeType` + `responseJsonSchema`. A chave vai SEMPRE no header
 * `x-goog-api-key`, nunca na URL. Não envia `thinkingConfig`: os níveis aceitos variam por modelo.
 * Referência: https://ai.google.dev/api/generate-content
 */
export const geminiAdapter: ProviderAdapter = {
  id: 'gemini',
  rotulo: ROTULO_PROVEDOR.gemini,

  async gerar(cfg, req) {
    const resposta = await chamarProvedor({
      provedor: 'gemini',
      chave: cfg.chave,
      modelo: cfg.modelo,
      url: `${BASE}/models/${encodeURIComponent(cfg.modelo)}:generateContent`,
      metodo: 'POST',
      headers: { 'x-goog-api-key': cfg.chave, 'Content-Type': 'application/json' },
      corpo: {
        systemInstruction: { parts: [{ text: req.sistema }] },
        contents: [{ role: 'user', parts: [{ text: req.usuario }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: req.schema,
          maxOutputTokens: MODELOS.gemini.maxSaida,
        },
      },
      signal: req.signal,
    });

    const corpo = ehRegistro(resposta) ? resposta : {};
    const feedback = ehRegistro(corpo.promptFeedback) ? corpo.promptFeedback : {};
    if (
      typeof feedback.blockReason === 'string' &&
      feedback.blockReason !== 'BLOCK_REASON_UNSPECIFIED'
    ) {
      throw erroProvedor('recusa', 'gemini');
    }

    const candidato = comoLista(corpo.candidates)[0];
    if (!ehRegistro(candidato)) throw erroProvedor('json_invalido', 'gemini');

    const motivo = typeof candidato.finishReason === 'string' ? candidato.finishReason : 'STOP';
    if (motivo === 'MAX_TOKENS') throw erroProvedor('cortado', 'gemini');
    if (FINALIZACAO_RECUSA.has(motivo)) throw erroProvedor('recusa', 'gemini');
    if (motivo !== 'STOP') throw erroProvedor('instavel', 'gemini', { repetivel: false });

    const conteudo = ehRegistro(candidato.content) ? candidato.content : {};
    const textos: string[] = [];
    for (const parte of comoLista(conteudo.parts)) {
      if (!ehRegistro(parte) || parte.thought === true) continue;
      if (typeof parte.text === 'string') textos.push(parte.text);
    }
    return interpretarSaida(textos.join(''), req.schema, 'gemini');
  },

  async testarChave(cfg, signal) {
    await chamarProvedor({
      provedor: 'gemini',
      chave: cfg.chave,
      url: `${BASE}/models`,
      metodo: 'GET',
      headers: { 'x-goog-api-key': cfg.chave },
      signal,
    });
  },
};
