import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { gerarComFallback } from './chain';
import { ErroCadeia, ErroProvedor } from './errors';
import { criarKeyStore } from './keys';
import { openaiAdapter } from './providers/openai';
import type {
  ErroTipo,
  GenerateRequest,
  ProviderAdapter,
  ProviderConfig,
  ProviderId,
} from './types';

const cadeia: ProviderConfig[] = [
  { id: 'openai', modelo: 'gpt-6-luna', chave: 'k1' },
  { id: 'gemini', modelo: 'gemini-3.8-flash', chave: 'k2' },
  { id: 'anthropic', modelo: 'claude-haiku-5-5', chave: 'k3' },
];

function reqCom(signal = new AbortController().signal): GenerateRequest {
  return { sistema: 's', usuario: 'u', schema: { type: 'string' }, nomeSchema: 'n', signal };
}

type Gerar = (cfg: ProviderConfig, req: GenerateRequest) => Promise<unknown>;

function adaptadores(impl: Partial<Record<ProviderId, Gerar>>): {
  a: Record<ProviderId, ProviderAdapter>;
  gerar: Record<ProviderId, Mock<Gerar>>;
} {
  const gerar = {
    openai: vi.fn<Gerar>(impl.openai ?? naoDeveriaSerChamado),
    gemini: vi.fn<Gerar>(impl.gemini ?? naoDeveriaSerChamado),
    anthropic: vi.fn<Gerar>(impl.anthropic ?? naoDeveriaSerChamado),
  };
  const mk = (id: ProviderId, rotulo: string): ProviderAdapter => ({
    id,
    rotulo,
    gerar: gerar[id],
    testarChave: () => Promise.resolve(),
  });
  return {
    a: {
      openai: mk('openai', 'OpenAI'),
      gemini: mk('gemini', 'Google Gemini'),
      anthropic: mk('anthropic', 'Anthropic'),
    },
    gerar,
  };
}

const naoDeveriaSerChamado: Gerar = () => Promise.reject(new Error('não deveria ser chamado'));

const falha = (tipo: ErroTipo, id: ProviderId): Promise<never> =>
  Promise.reject(new ErroProvedor(tipo, id, `falha ${tipo} ${id}`));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('gerarComFallback', () => {
  it('devolve o resultado do primeiro quando dá certo', async () => {
    const { a } = adaptadores({ openai: () => Promise.resolve({ ok: 1 }) });
    const r = await gerarComFallback(cadeia, reqCom(), { adaptadores: a });
    expect(r).toEqual({ valor: { ok: 1 }, provedor: 'openai', modelo: 'gpt-6-luna', falhas: [] });
  });

  it('429 duas vezes no primeiro (1 retry após 2 s) e o segundo responde', async () => {
    const { a, gerar } = adaptadores({
      openai: () => falha('limite', 'openai'),
      gemini: () => Promise.resolve({ ok: 2 }),
    });
    const promessa = gerarComFallback(cadeia, reqCom(), { adaptadores: a });
    await vi.advanceTimersByTimeAsync(0);
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const r = await promessa;
    expect(gerar.openai).toHaveBeenCalledTimes(2);
    expect(r.provedor).toBe('gemini');
    expect(r.modelo).toBe('gemini-3.8-flash');
    expect(r.valor).toEqual({ ok: 2 });
    expect(r.falhas).toEqual([
      { provedor: 'openai', erro: 'limite', mensagem: 'falha limite openai' },
    ]);
  });

  it('instável no primeiro e sucesso no retry não registra falha', async () => {
    let n = 0;
    const { a } = adaptadores({
      openai: () => (n++ === 0 ? falha('instavel', 'openai') : Promise.resolve('ok')),
    });
    const promessa = gerarComFallback(cadeia, reqCom(), { adaptadores: a });
    await vi.advanceTimersByTimeAsync(2_000);
    const r = await promessa;
    expect(r).toMatchObject({ valor: 'ok', provedor: 'openai', falhas: [] });
  });

  it('instável de resposta 200 (não repetível) avança sem retry nem espera', async () => {
    const { a, gerar } = adaptadores({
      openai: () =>
        Promise.reject(
          new ErroProvedor('instavel', 'openai', 'falha 200', 200, {
            repetivel: false,
          }),
        ),
      gemini: () => Promise.resolve('ok'),
    });
    const r = await gerarComFallback(cadeia, reqCom(), { adaptadores: a });
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    expect(r.provedor).toBe('gemini');
    expect(r.falhas[0]).toMatchObject({ provedor: 'openai', erro: 'instavel' });
  });

  it('normaliza (trim) o id do modelo uma vez, na entrada da cadeia', async () => {
    const { a, gerar } = adaptadores({ openai: () => Promise.resolve('ok') });
    const r = await gerarComFallback(
      [{ id: 'openai', modelo: '  gpt-6-luna \n', chave: 'k1' }],
      reqCom(),
      { adaptadores: a },
    );
    expect(gerar.openai.mock.calls[0]?.[0].modelo).toBe('gpt-6-luna');
    expect(r.modelo).toBe('gpt-6-luna');
  });

  it.each<ErroTipo>([
    'chave_invalida',
    'cortado',
    'json_invalido',
    'recusa',
    'rede',
    'parametro',
    'muito_longo',
    'inesperado',
  ])('erro %s avança direto, sem retry nem espera', async (tipo) => {
    const { a, gerar } = adaptadores({
      openai: () => falha(tipo, 'openai'),
      gemini: () => Promise.resolve('ok'),
    });
    const r = await gerarComFallback(cadeia, reqCom(), { adaptadores: a });
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    expect(r.provedor).toBe('gemini');
    expect(r.falhas[0]).toMatchObject({ provedor: 'openai', erro: tipo });
  });

  it('cota esgotada da OpenAI passa direto para o próximo e marca a chave como recusada', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              message:
                'You exceeded your current quota, please check your plan and billing details.',
              type: 'insufficient_quota',
              code: 'insufficient_quota',
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchFalso);
    try {
      const { a } = adaptadores({ gemini: () => Promise.resolve({ ok: 2 }) });
      const store = criarKeyStore(null);
      store.definir({ provedor: 'openai', chave: 'k1', modelo: '', estado: 'nao_testada' });
      const aoRecusarChave = vi.fn((cfg: ProviderConfig, erro: ErroProvedor) => {
        store.definirEstado(cfg.id, cfg.chave, 'invalida', erro.motivo);
      });
      // Sem avançar os timers: se houvesse espera de retry, a promessa não resolveria.
      const r = await gerarComFallback(cadeia, reqCom(), {
        adaptadores: { ...a, openai: openaiAdapter },
        aoRecusarChave,
      });

      expect(fetchFalso).toHaveBeenCalledTimes(1);
      expect(r.provedor).toBe('gemini');
      expect(r.falhas).toHaveLength(1);
      expect(r.falhas[0]).toMatchObject({ provedor: 'openai', erro: 'chave_invalida' });
      expect(r.falhas[0]?.mensagem).toContain('sem crédito ou saldo');
      expect(aoRecusarChave).toHaveBeenCalledTimes(1);
      expect(aoRecusarChave).toHaveBeenCalledWith(cadeia[0], expect.any(ErroProvedor));
      // A chave sai da cadeia e fica marcada como sem saldo, não como "mal copiada".
      expect(store.cadeia()).toEqual([]);
      expect(store.listar()[0]).toMatchObject({ estado: 'invalida', motivo: 'sem_credito' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cancelado interrompe a cadeia e não tenta o próximo', async () => {
    const { a, gerar } = adaptadores({ openai: () => falha('cancelado', 'openai') });
    await expect(gerarComFallback(cadeia, reqCom(), { adaptadores: a })).rejects.toMatchObject({
      tipo: 'cancelado',
    });
    expect(gerar.gemini).not.toHaveBeenCalled();
    expect(gerar.anthropic).not.toHaveBeenCalled();
  });

  it('cancelar durante a espera do retry vira cancelado e não faz nova chamada', async () => {
    const ctl = new AbortController();
    const { a, gerar } = adaptadores({ openai: () => falha('limite', 'openai') });
    const promessa = gerarComFallback(cadeia, reqCom(ctl.signal), { adaptadores: a });
    const checada = expect(promessa).rejects.toMatchObject({ tipo: 'cancelado' });
    await vi.advanceTimersByTimeAsync(500);
    ctl.abort();
    await checada;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(gerar.openai).toHaveBeenCalledTimes(1);
    expect(gerar.gemini).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sinal já abortado não chama ninguém', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const { a, gerar } = adaptadores({});
    await expect(
      gerarComFallback(cadeia, reqCom(ctl.signal), { adaptadores: a }),
    ).rejects.toMatchObject({ tipo: 'cancelado' });
    expect(gerar.openai).not.toHaveBeenCalled();
  });

  it('todos falham: ErroCadeia com as três falhas em ordem', async () => {
    const { a, gerar } = adaptadores({
      openai: () => falha('limite', 'openai'),
      gemini: () => falha('recusa', 'gemini'),
      anthropic: () => falha('instavel', 'anthropic'),
    });
    const checada = gerarComFallback(cadeia, reqCom(), { adaptadores: a }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const e = await checada;
    expect(e).toBeInstanceOf(ErroCadeia);
    const erroCadeia = e as ErroCadeia;
    expect(erroCadeia.falhas.map((f) => [f.provedor, f.erro])).toEqual([
      ['openai', 'limite'],
      ['gemini', 'recusa'],
      ['anthropic', 'instavel'],
    ]);
    expect(erroCadeia.message).toContain('OpenAI');
    expect(erroCadeia.message).toContain('Anthropic');
    expect(gerar.openai).toHaveBeenCalledTimes(2);
    expect(gerar.gemini).toHaveBeenCalledTimes(1);
    expect(gerar.anthropic).toHaveBeenCalledTimes(2);
  });

  it('erro inesperado (não ErroProvedor) vira falha instavel sem vazar o texto', async () => {
    const { a } = adaptadores({
      openai: () => Promise.reject(new Error('quebrou com k1')),
      gemini: () => Promise.resolve('ok'),
    });
    const promessa = gerarComFallback(cadeia, reqCom(), { adaptadores: a });
    await vi.advanceTimersByTimeAsync(2_000);
    const r = await promessa;
    expect(r.falhas[0]?.erro).toBe('instavel');
    expect(r.falhas[0]?.mensagem).not.toContain('k1');
  });

  it('chave recusada avisa quem chamou com a configuração usada e segue para o próximo', async () => {
    const { a } = adaptadores({
      openai: () => falha('chave_invalida', 'openai'),
      gemini: () => Promise.resolve({ ok: 2 }),
    });
    const aoRecusarChave = vi.fn();
    const r = await gerarComFallback(cadeia, reqCom(), { adaptadores: a, aoRecusarChave });
    expect(r.provedor).toBe('gemini');
    expect(aoRecusarChave).toHaveBeenCalledTimes(1);
    expect(aoRecusarChave).toHaveBeenCalledWith(cadeia[0], expect.any(ErroProvedor));
  });

  it('chave recusada também é avisada quando toda a cadeia falha; outros erros não', async () => {
    const { a } = adaptadores({
      openai: () => falha('json_invalido', 'openai'),
      gemini: () => falha('chave_invalida', 'gemini'),
      anthropic: () => falha('recusa', 'anthropic'),
    });
    const aoRecusarChave = vi.fn();
    await expect(
      gerarComFallback(cadeia, reqCom(), { adaptadores: a, aoRecusarChave }),
    ).rejects.toBeInstanceOf(ErroCadeia);
    expect(aoRecusarChave).toHaveBeenCalledTimes(1);
    expect(aoRecusarChave).toHaveBeenCalledWith(cadeia[1], expect.any(ErroProvedor));
  });

  it('cadeia vazia lança ErroCadeia explicando o que fazer', async () => {
    const { a } = adaptadores({});
    await expect(gerarComFallback([], reqCom(), { adaptadores: a })).rejects.toBeInstanceOf(
      ErroCadeia,
    );
  });
});
