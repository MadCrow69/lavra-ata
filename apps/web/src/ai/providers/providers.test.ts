import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroProvedor, sanitizar } from '../errors';
import type { ErroTipo, GenerateRequest, JsonSchema, ProviderConfig, ProviderId } from '../types';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { openaiAdapter } from './openai';

const SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['idioma'],
  properties: { idioma: { type: 'string' } },
};

function req(signal: AbortSignal = new AbortController().signal): GenerateRequest {
  return {
    sistema: 'Você redige atas.',
    usuario: 'Transcrição fictícia.',
    schema: SCHEMA,
    nomeSchema: 'ata_teste',
    signal,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchFalso: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchFalso = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchFalso);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function chamada(n = 0): {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
  corpo: Record<string, unknown>;
} {
  const [url, init] = fetchFalso.mock.calls[n] ?? [];
  const i = init ?? {};
  return {
    url: typeof url === 'string' ? url : '',
    init: i,
    headers: i.headers as Record<string, string>,
    corpo: typeof i.body === 'string' ? (JSON.parse(i.body) as Record<string, unknown>) : {},
  };
}

function comumOk(init: RequestInit, signal: AbortSignal): void {
  expect(init.credentials).toBe('omit');
  expect(init.referrerPolicy).toBe('no-referrer');
  expect(init.cache).toBe('no-store');
  expect(init.signal).toBe(signal);
}

// ---------------------------------------------------------------- OpenAI
const CHAVE_OPENAI = 'sk-teste-123';
const cfgOpenai: ProviderConfig = { id: 'openai', modelo: 'gpt-6-luna', chave: CHAVE_OPENAI };

function respostaOpenai(texto: string, extra: Record<string, unknown> = {}): Response {
  return json({
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: texto }] },
    ],
    ...extra,
  });
}

describe('openaiAdapter.gerar', () => {
  it('envia corpo e headers exatos e devolve o objeto', async () => {
    fetchFalso.mockResolvedValueOnce(respostaOpenai('{"idioma":"pt-BR"}'));
    const r = req();
    const out = await openaiAdapter.gerar(cfgOpenai, r);
    expect(out).toEqual({ idioma: 'pt-BR' });

    const c = chamada();
    expect(c.url).toBe('https://api.openai.com/v1/responses');
    expect(c.init.method).toBe('POST');
    expect(c.headers).toEqual({
      Authorization: `Bearer ${CHAVE_OPENAI}`,
      'Content-Type': 'application/json',
    });
    expect(c.corpo).toEqual({
      model: 'gpt-6-luna',
      input: [
        { role: 'system', content: 'Você redige atas.' },
        { role: 'user', content: 'Transcrição fictícia.' },
      ],
      store: false,
      max_output_tokens: 16_000,
      reasoning: { effort: 'none' },
      text: { format: { type: 'json_schema', name: 'ata_teste', strict: true, schema: SCHEMA } },
    });
    comumOk(c.init, r.signal);
    expect(c.url).not.toContain(CHAVE_OPENAI);
  });

  it('usa o esforço declarado do modelo e omite o parâmetro para id livre', async () => {
    fetchFalso.mockImplementation(() => Promise.resolve(respostaOpenai('{"idioma":"pt-BR"}')));
    await openaiAdapter.gerar({ ...cfgOpenai, modelo: 'gpt-6.1-sol' }, req());
    await openaiAdapter.gerar({ ...cfgOpenai, modelo: 'modelo-digitado' }, req());
    expect(chamada(0).corpo.reasoning).toEqual({ effort: 'low' });
    expect(chamada(1).corpo).not.toHaveProperty('reasoning');
  });

  it('status incomplete por max_output_tokens vira cortado', async () => {
    fetchFalso.mockResolvedValueOnce(
      respostaOpenai('{"idioma":"pt', {
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      }),
    );
    await expect(openaiAdapter.gerar(cfgOpenai, req())).rejects.toMatchObject({
      tipo: 'cortado',
      provedor: 'openai',
    });
  });

  it('status incomplete por content_filter vira recusa', async () => {
    fetchFalso.mockResolvedValueOnce(
      respostaOpenai('', {
        status: 'incomplete',
        incomplete_details: { reason: 'content_filter' },
      }),
    );
    await expect(openaiAdapter.gerar(cfgOpenai, req())).rejects.toMatchObject({ tipo: 'recusa' });
  });

  it('item refusal vira recusa', async () => {
    fetchFalso.mockResolvedValueOnce(
      json({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Não posso.' }] }],
      }),
    );
    await expect(openaiAdapter.gerar(cfgOpenai, req())).rejects.toMatchObject({ tipo: 'recusa' });
  });

  it('texto que não é JSON vira json_invalido', async () => {
    fetchFalso.mockResolvedValueOnce(respostaOpenai('isto não é json'));
    await expect(openaiAdapter.gerar(cfgOpenai, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
  });

  it('JSON fora do schema vira json_invalido', async () => {
    fetchFalso.mockResolvedValueOnce(respostaOpenai('{"idioma":"pt-BR","extra":1}'));
    await expect(openaiAdapter.gerar(cfgOpenai, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
  });

  it('resposta sem texto vira json_invalido', async () => {
    fetchFalso.mockResolvedValueOnce(json({ status: 'completed', output: [] }));
    await expect(openaiAdapter.gerar(cfgOpenai, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
  });
});

describe('openaiAdapter.testarChave', () => {
  it('faz GET /v1/models com a chave no header', async () => {
    fetchFalso.mockResolvedValueOnce(json({ data: [] }));
    const ctl = new AbortController();
    await openaiAdapter.testarChave({ id: 'openai', chave: CHAVE_OPENAI }, ctl.signal);
    const c = chamada();
    expect(c.url).toBe('https://api.openai.com/v1/models');
    expect(c.init.method).toBe('GET');
    expect(c.headers).toEqual({ Authorization: `Bearer ${CHAVE_OPENAI}` });
    expect(c.init.body).toBeUndefined();
    comumOk(c.init, ctl.signal);
  });
});

// ---------------------------------------------------------------- Gemini
const CHAVE_GEMINI = 'AIzaTesteChaveFicticia1234567890abcd';
const cfgGemini: ProviderConfig = { id: 'gemini', modelo: 'gemini-3.8-flash', chave: CHAVE_GEMINI };

function respostaGemini(parts: unknown[], finishReason = 'STOP'): Response {
  return json({ candidates: [{ content: { role: 'model', parts }, finishReason }] });
}

describe('geminiAdapter.gerar', () => {
  it('envia corpo e headers exatos, sem thinkingConfig e sem chave na URL', async () => {
    fetchFalso.mockResolvedValueOnce(respostaGemini([{ text: '{"idioma":"pt-BR"}' }]));
    const r = req();
    const out = await geminiAdapter.gerar(cfgGemini, r);
    expect(out).toEqual({ idioma: 'pt-BR' });

    const c = chamada();
    expect(c.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
    expect(c.url).not.toContain('key=');
    expect(c.url).not.toContain(CHAVE_GEMINI);
    expect(c.headers).toEqual({
      'x-goog-api-key': CHAVE_GEMINI,
      'Content-Type': 'application/json',
    });
    expect(c.corpo).toEqual({
      systemInstruction: { parts: [{ text: 'Você redige atas.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Transcrição fictícia.' }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: SCHEMA,
        maxOutputTokens: 16_000,
      },
    });
    expect(JSON.stringify(c.corpo)).not.toContain('thinkingConfig');
    comumOk(c.init, r.signal);
  });

  it('ignora partes com thought: true', async () => {
    fetchFalso.mockResolvedValueOnce(
      respostaGemini([
        { text: 'pensando em voz alta', thought: true },
        { text: '{"idioma":"pt-BR"}' },
      ]),
    );
    await expect(geminiAdapter.gerar(cfgGemini, req())).resolves.toEqual({ idioma: 'pt-BR' });
  });

  it('junta várias partes de texto', async () => {
    fetchFalso.mockResolvedValueOnce(
      respostaGemini([{ text: '{"idioma":' }, { text: '"pt-BR"}' }]),
    );
    await expect(geminiAdapter.gerar(cfgGemini, req())).resolves.toEqual({ idioma: 'pt-BR' });
  });

  it('MAX_TOKENS vira cortado', async () => {
    fetchFalso.mockResolvedValueOnce(respostaGemini([{ text: '{"idi' }], 'MAX_TOKENS'));
    await expect(geminiAdapter.gerar(cfgGemini, req())).rejects.toMatchObject({ tipo: 'cortado' });
  });

  it.each(['SAFETY', 'RECITATION'])('finishReason %s vira recusa', async (motivo) => {
    fetchFalso.mockResolvedValueOnce(respostaGemini([], motivo));
    await expect(geminiAdapter.gerar(cfgGemini, req())).rejects.toMatchObject({ tipo: 'recusa' });
  });

  it('promptFeedback.blockReason vira recusa', async () => {
    fetchFalso.mockResolvedValueOnce(json({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(geminiAdapter.gerar(cfgGemini, req())).rejects.toMatchObject({ tipo: 'recusa' });
  });

  it('texto que não é JSON ou fora do schema vira json_invalido', async () => {
    fetchFalso.mockResolvedValueOnce(respostaGemini([{ text: 'nada de json' }]));
    await expect(geminiAdapter.gerar(cfgGemini, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
    fetchFalso.mockResolvedValueOnce(respostaGemini([{ text: '{"outro":"x"}' }]));
    await expect(geminiAdapter.gerar(cfgGemini, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
  });

  it('sem candidatos e sem bloqueio vira json_invalido', async () => {
    fetchFalso.mockResolvedValueOnce(json({ candidates: [] }));
    await expect(geminiAdapter.gerar(cfgGemini, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
  });
});

describe('geminiAdapter.testarChave', () => {
  it('faz GET /v1beta/models com x-goog-api-key', async () => {
    fetchFalso.mockResolvedValueOnce(json({ models: [] }));
    const ctl = new AbortController();
    await geminiAdapter.testarChave({ id: 'gemini', chave: CHAVE_GEMINI }, ctl.signal);
    const c = chamada();
    expect(c.url).toBe('https://generativelanguage.googleapis.com/v1beta/models');
    expect(c.init.method).toBe('GET');
    expect(c.headers).toEqual({ 'x-goog-api-key': CHAVE_GEMINI });
    comumOk(c.init, ctl.signal);
  });
});

// ---------------------------------------------------------------- Anthropic
const CHAVE_ANTHROPIC = 'sk-ant-teste-ficticia-123';
const cfgAnthropic: ProviderConfig = {
  id: 'anthropic',
  modelo: 'claude-haiku-5-5',
  chave: CHAVE_ANTHROPIC,
};
const HEADERS_ANTHROPIC = {
  'x-api-key': CHAVE_ANTHROPIC,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
};

function respostaAnthropic(content: unknown[], stopReason = 'end_turn'): Response {
  return json({ type: 'message', role: 'assistant', content, stop_reason: stopReason });
}

describe('anthropicAdapter.gerar', () => {
  it('envia corpo e headers exatos e lê o bloco text depois do thinking', async () => {
    fetchFalso.mockResolvedValueOnce(
      respostaAnthropic([
        { type: 'thinking', thinking: '', signature: 'abc' },
        { type: 'text', text: '{"idioma":"pt-BR"}' },
      ]),
    );
    const r = req();
    const out = await anthropicAdapter.gerar(cfgAnthropic, r);
    expect(out).toEqual({ idioma: 'pt-BR' });

    const c = chamada();
    expect(c.url).toBe('https://api.anthropic.com/v1/messages');
    expect(c.headers).toEqual({ ...HEADERS_ANTHROPIC, 'Content-Type': 'application/json' });
    expect(c.corpo).toEqual({
      model: 'claude-haiku-5-5',
      max_tokens: 16_000,
      system: 'Você redige atas.',
      messages: [{ role: 'user', content: 'Transcrição fictícia.' }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: 'low' },
    });
    for (const proibido of ['thinking', 'temperature', 'top_p', 'top_k', 'fallbacks']) {
      expect(c.corpo).not.toHaveProperty(proibido);
    }
    comumOk(c.init, r.signal);
  });

  it('omite effort para id digitado livremente e usa o do modelo da lista', async () => {
    fetchFalso.mockImplementation(() =>
      Promise.resolve(respostaAnthropic([{ type: 'text', text: '{"idioma":"pt-BR"}' }])),
    );
    await anthropicAdapter.gerar({ ...cfgAnthropic, modelo: 'claude-sonnet-5-5' }, req());
    await anthropicAdapter.gerar({ ...cfgAnthropic, modelo: 'modelo-digitado' }, req());
    expect(chamada(0).corpo.output_config).toMatchObject({ effort: 'low' });
    const livre = chamada(1).corpo.output_config as Record<string, unknown>;
    expect(livre).not.toHaveProperty('effort');
    expect(livre.format).toEqual({ type: 'json_schema', schema: SCHEMA });
  });

  it('max_tokens vira cortado, mesmo sem nenhum bloco de texto', async () => {
    fetchFalso.mockResolvedValueOnce(
      respostaAnthropic([{ type: 'thinking', thinking: '', signature: 'abc' }], 'max_tokens'),
    );
    await expect(anthropicAdapter.gerar(cfgAnthropic, req())).rejects.toMatchObject({
      tipo: 'cortado',
    });
  });

  it('stop_reason refusal vira recusa', async () => {
    fetchFalso.mockResolvedValueOnce(respostaAnthropic([], 'refusal'));
    await expect(anthropicAdapter.gerar(cfgAnthropic, req())).rejects.toMatchObject({
      tipo: 'recusa',
    });
  });

  it('texto que não é JSON ou fora do schema vira json_invalido', async () => {
    fetchFalso.mockResolvedValueOnce(respostaAnthropic([{ type: 'text', text: 'oi' }]));
    await expect(anthropicAdapter.gerar(cfgAnthropic, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
    fetchFalso.mockResolvedValueOnce(respostaAnthropic([{ type: 'text', text: '{"idioma":1}' }]));
    await expect(anthropicAdapter.gerar(cfgAnthropic, req())).rejects.toMatchObject({
      tipo: 'json_invalido',
    });
  });
});

describe('anthropicAdapter.testarChave', () => {
  it('faz GET /v1/models com os mesmos headers do messages', async () => {
    fetchFalso.mockResolvedValueOnce(json({ data: [] }));
    const ctl = new AbortController();
    await anthropicAdapter.testarChave({ id: 'anthropic', chave: CHAVE_ANTHROPIC }, ctl.signal);
    const c = chamada();
    expect(c.url).toBe('https://api.anthropic.com/v1/models');
    expect(c.init.method).toBe('GET');
    expect(c.headers).toEqual(HEADERS_ANTHROPIC);
    comumOk(c.init, ctl.signal);
  });
});

// ---------------------------------------------------------------- Erros comuns aos três
interface Caso {
  id: ProviderId;
  cfg: ProviderConfig;
  gerar: (cfg: ProviderConfig, r: GenerateRequest) => Promise<unknown>;
  testar: (signal: AbortSignal) => Promise<void>;
}

const casos: Caso[] = [
  {
    id: 'openai',
    cfg: cfgOpenai,
    gerar: (c, r) => openaiAdapter.gerar(c, r),
    testar: (s) => openaiAdapter.testarChave({ id: 'openai', chave: CHAVE_OPENAI }, s),
  },
  {
    id: 'gemini',
    cfg: cfgGemini,
    gerar: (c, r) => geminiAdapter.gerar(c, r),
    testar: (s) => geminiAdapter.testarChave({ id: 'gemini', chave: CHAVE_GEMINI }, s),
  },
  {
    id: 'anthropic',
    cfg: cfgAnthropic,
    gerar: (c, r) => anthropicAdapter.gerar(c, r),
    testar: (s) => anthropicAdapter.testarChave({ id: 'anthropic', chave: CHAVE_ANTHROPIC }, s),
  },
];

const statusParaTipo: [number, ErroTipo][] = [
  [401, 'chave_invalida'],
  [403, 'chave_invalida'],
  [429, 'limite'],
  [500, 'instavel'],
  [503, 'instavel'],
  [529, 'instavel'],
];

async function erroDe(p: Promise<unknown>): Promise<ErroProvedor> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErroProvedor);
    return e as ErroProvedor;
  }
  throw new Error('esperava rejeição');
}

describe.each(casos)('erros HTTP e de rede — $id', ({ id, cfg, gerar, testar }) => {
  const erroApi = (message: string, extra: Record<string, unknown> = {}): Response =>
    json({ error: { message, ...extra } }, 400);

  it('400 de valor não suportado vira parametro em gerar e inesperado no teste de chave', async () => {
    fetchFalso.mockImplementation(() => Promise.resolve(erroApi('Unsupported value: effort.')));
    const e1 = await erroDe(gerar(cfg, req()));
    expect(e1).toMatchObject({ tipo: 'parametro', provedor: id, status: 400 });
    const e2 = await erroDe(testar(new AbortController().signal));
    expect(e2).toMatchObject({ tipo: 'inesperado', provedor: id, status: 400 });
    expect(e2.message).not.toContain('O modelo');
  });

  it('400 com campo param preenchido vira parametro', async () => {
    fetchFalso.mockResolvedValueOnce(erroApi('Algo sobre o campo.', { param: 'reasoning.effort' }));
    expect((await erroDe(gerar(cfg, req()))).tipo).toBe('parametro');
  });

  it.each([
    ['context_length_exceeded', { code: 'context_length_exceeded' }, 'Context window.'],
    ['prompt is too long', {}, 'prompt is too long: 250000 tokens > 200000 maximum'],
    [
      'input token count',
      {},
      'The input token count (300000) exceeds the maximum number of tokens allowed (1048576).',
    ],
  ])('estouro de contexto (%s) vira muito_longo', async (_nome, extra, msg) => {
    fetchFalso.mockResolvedValueOnce(erroApi(msg, extra));
    const e = await erroDe(gerar(cfg, req()));
    expect(e.tipo).toBe('muito_longo');
    expect(e.message).toBe(
      `A transcrição ficou grande demais para o modelo ${cfg.modelo}. Divida a reunião ou escolha um modelo com mais contexto.`,
    );
  });

  it('HTTP 413 vira muito_longo', async () => {
    fetchFalso.mockResolvedValueOnce(json({ error: { message: 'Request too large' } }, 413));
    expect((await erroDe(gerar(cfg, req()))).tipo).toBe('muito_longo');
  });

  it('404 diz que o modelo não foi encontrado (só em gerar)', async () => {
    fetchFalso.mockImplementation(() =>
      Promise.resolve(json({ error: { message: 'not found' } }, 404)),
    );
    const e1 = await erroDe(gerar(cfg, req()));
    expect(e1.message).toBe(
      `O modelo ${cfg.modelo} não foi encontrado neste provedor. Confira o nome nas configurações.`,
    );
    const e2 = await erroDe(testar(new AbortController().signal));
    expect(e2.tipo).toBe('inesperado');
    expect(e2.message).not.toContain('O modelo');
  });

  it('outros 4xx viram inesperado, com o status na mensagem', async () => {
    fetchFalso.mockResolvedValueOnce(json({ error: { message: 'Algo estranho' } }, 418));
    const e = await erroDe(gerar(cfg, req()));
    expect(e.tipo).toBe('inesperado');
    expect(e.message).toContain('HTTP 418');
    fetchFalso.mockResolvedValueOnce(erroApi('Pedido malformado sem pistas'));
    expect((await erroDe(gerar(cfg, req()))).tipo).toBe('inesperado');
  });

  it('429 e 5xx são repetíveis; 4xx de parâmetro não', async () => {
    fetchFalso.mockResolvedValueOnce(json({ error: { message: 'x' } }, 429));
    expect((await erroDe(gerar(cfg, req()))).repetivel).toBe(true);
    fetchFalso.mockResolvedValueOnce(json({ error: { message: 'x' } }, 529));
    expect((await erroDe(gerar(cfg, req()))).repetivel).toBe(true);
    fetchFalso.mockResolvedValueOnce(erroApi('Unsupported value'));
    expect((await erroDe(gerar(cfg, req()))).repetivel).toBe(false);
  });

  it.each(statusParaTipo)('HTTP %i vira %s (gerar e testarChave)', async (status, tipo) => {
    fetchFalso.mockImplementation(() =>
      Promise.resolve(
        json({ error: { type: 'x', message: 'Unsupported value: effort.' } }, status),
      ),
    );
    const e1 = await erroDe(gerar(cfg, req()));
    expect(e1).toMatchObject({ tipo, provedor: id, status });
    const e2 = await erroDe(testar(new AbortController().signal));
    expect(e2).toMatchObject({ tipo, provedor: id, status });
  });

  it('400 usa a mensagem de modelo não aceito, citando o modelo', async () => {
    fetchFalso.mockResolvedValueOnce(
      json({ error: { message: 'reasoning.effort not supported' } }, 400),
    );
    const e = await erroDe(gerar(cfg, req()));
    expect(e.message).toBe(
      `O modelo ${cfg.modelo} não aceitou a configuração enviada. Escolha outro modelo nas configurações.`,
    );
  });

  it('TypeError do fetch vira rede', async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const e = await erroDe(gerar(cfg, req()));
    expect(e.tipo).toBe('rede');
    expect(e.message).toContain(
      'O provedor recusou a chamada direta do navegador ou a conexão falhou.',
    );
  });

  it('AbortError vira cancelado', async () => {
    fetchFalso.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    const e = await erroDe(gerar(cfg, req()));
    expect(e.tipo).toBe('cancelado');
  });

  it('sinal já abortado vira cancelado, mesmo se o fetch falhar com outro erro', async () => {
    const ctl = new AbortController();
    ctl.abort();
    fetchFalso.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const e = await erroDe(gerar(cfg, req(ctl.signal)));
    expect(e.tipo).toBe('cancelado');
  });

  it('corpo de erro que não é JSON ainda é classificado pelo status', async () => {
    fetchFalso.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));
    const e = await erroDe(gerar(cfg, req()));
    expect(e.tipo).toBe('instavel');
  });

  it('nenhuma mensagem de erro contém a chave, mesmo se o provedor a ecoar', async () => {
    const chave = cfg.chave;
    const eco = `Incorrect API key provided: ${chave}. Header x-api-key: ${chave}; Authorization: Bearer ${chave}`;
    for (const [status] of statusParaTipo) {
      fetchFalso.mockImplementation(() =>
        Promise.resolve(json({ error: { message: eco } }, status)),
      );
      const e1 = await erroDe(gerar(cfg, req()));
      const e2 = await erroDe(testar(new AbortController().signal));
      for (const e of [e1, e2]) {
        expect(e.message).not.toContain(chave);
        expect(e.message).not.toMatch(/sk-|AIza/);
        expect(JSON.stringify(e)).not.toContain(chave);
      }
    }
  });
});

describe('Gemini: chave inválida vem como HTTP 400', () => {
  const corpoReal = {
    error: {
      code: 400,
      message: 'API key not valid. Please pass a valid API key.',
      status: 'INVALID_ARGUMENT',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'API_KEY_INVALID',
          domain: 'googleapis.com',
        },
      ],
    },
  };

  it('gerar e testarChave viram chave_invalida (e não parametro)', async () => {
    fetchFalso.mockImplementation(() => Promise.resolve(json(corpoReal, 400)));
    const e1 = await erroDe(geminiAdapter.gerar(cfgGemini, req()));
    expect(e1).toMatchObject({ tipo: 'chave_invalida', status: 400 });
    const e2 = await erroDe(
      geminiAdapter.testarChave(
        { id: 'gemini', chave: CHAVE_GEMINI },
        new AbortController().signal,
      ),
    );
    expect(e2).toMatchObject({ tipo: 'chave_invalida', status: 400 });
    expect(e2.message).not.toContain('O modelo');
  });

  it('reconhece também só pela mensagem, sem details', async () => {
    fetchFalso.mockResolvedValueOnce(
      json({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400),
    );
    expect((await erroDe(geminiAdapter.gerar(cfgGemini, req()))).tipo).toBe('chave_invalida');
  });
});

describe('retry só para falha de nível HTTP/rede', () => {
  it('resposta 200 classificada como instavel não é repetível', async () => {
    fetchFalso.mockResolvedValueOnce(json({ status: 'failed', output: [] }));
    const e1 = await erroDe(openaiAdapter.gerar(cfgOpenai, req()));
    expect(e1).toMatchObject({ tipo: 'instavel', repetivel: false });
    fetchFalso.mockResolvedValueOnce(respostaGemini([{ text: 'x' }], 'OTHER'));
    const e2 = await erroDe(geminiAdapter.gerar(cfgGemini, req()));
    expect(e2).toMatchObject({ tipo: 'instavel', repetivel: false });
    fetchFalso.mockResolvedValueOnce(respostaAnthropic([], 'pause_turn'));
    const e3 = await erroDe(anthropicAdapter.gerar(cfgAnthropic, req()));
    expect(e3).toMatchObject({ tipo: 'instavel', repetivel: false });
  });
});

describe('sanitizar', () => {
  it('remove chave sem formato conhecido, inclusive com espaços nas pontas', () => {
    const eco = 'Falha com minha-chave-123456 na chamada';
    expect(sanitizar(eco, 'minha-chave-123456')).not.toContain('minha-chave-123456');
    expect(sanitizar(eco, '  minha-chave-123456 ')).not.toContain('minha-chave-123456');
  });

  it('não corta palavras que apenas terminam em "sk-"', () => {
    const saida = sanitizar('risk-assessment e task-force seguem, mas sk-abc123 some', 'outra');
    expect(saida).toContain('risk-assessment');
    expect(saida).toContain('task-force');
    expect(saida).not.toContain('sk-abc123');
  });
});

describe('sanitização de trechos do provedor', () => {
  it('remove chaves com formato sk-, sk-ant- e AIza mesmo que não sejam a chave da pessoa', async () => {
    const eco =
      'Chave sk-proj-AbC123_xyz e sk-ant-api03-ZZ99-yy e AIzaSyD-outraChave_123 recusadas';
    fetchFalso.mockResolvedValueOnce(json({ error: { message: eco } }, 500));
    const e = await erroDe(openaiAdapter.gerar(cfgOpenai, req()));
    expect(e.message).not.toMatch(/sk-proj|sk-ant|AIza|AbC123|ZZ99|outraChave/);
  });

  it('mensagem de crédito esgotado orienta sobre o saldo', async () => {
    fetchFalso.mockResolvedValueOnce(
      json(
        {
          error: {
            type: 'invalid_request_error',
            message: 'Your credit balance is too low to access the API.',
          },
        },
        400,
      ),
    );
    const e = await erroDe(anthropicAdapter.gerar(cfgAnthropic, req()));
    expect(e.tipo).toBe('chave_invalida');
    expect(e.message).toMatch(/saldo|crédito/);
  });
});
