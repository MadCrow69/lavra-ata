import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { gerarComFallback } from './chain';
import { ErroCadeia, ErroProvedor } from './errors';
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

  it.each<ErroTipo>(['chave_invalida', 'cortado', 'json_invalido', 'recusa', 'rede', 'parametro'])(
    'erro %s avança direto, sem retry nem espera',
    async (tipo) => {
      const { a, gerar } = adaptadores({
        openai: () => falha(tipo, 'openai'),
        gemini: () => Promise.resolve('ok'),
      });
      const r = await gerarComFallback(cadeia, reqCom(), { adaptadores: a });
      expect(gerar.openai).toHaveBeenCalledTimes(1);
      expect(r.provedor).toBe('gemini');
      expect(r.falhas[0]).toMatchObject({ provedor: 'openai', erro: tipo });
    },
  );

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

  it('cadeia vazia lança ErroCadeia explicando o que fazer', async () => {
    const { a } = adaptadores({});
    await expect(gerarComFallback([], reqCom(), { adaptadores: a })).rejects.toBeInstanceOf(
      ErroCadeia,
    );
  });
});
