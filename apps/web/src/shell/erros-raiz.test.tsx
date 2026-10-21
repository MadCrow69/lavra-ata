import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MENSAGEM_ERRO_RAIZ, OPCOES_RAIZ } from './erros-raiz';

const erro = new Error('falhou com sk-teste-123 e 529.982.247-25');
const info = { componentStack: '\n    at Segredo' };

type Espiao = MockInstance<(...args: unknown[]) => void>;
let espiaoErro: Espiao;
let espiaoAviso: Espiao;
let espiaoLog: Espiao;

beforeEach(() => {
  espiaoErro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  espiaoAviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  espiaoLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const handlers = [
  ['onCaughtError', () => OPCOES_RAIZ.onCaughtError],
  ['onUncaughtError', () => OPCOES_RAIZ.onUncaughtError],
  ['onRecoverableError', () => OPCOES_RAIZ.onRecoverableError],
] as const;

describe('OPCOES_RAIZ: erros da raiz do React', () => {
  it.each(handlers)('%s registra só a mensagem fixa, sem dados da ata', (_nome, obter) => {
    const handler = obter() as (e: unknown, i: unknown) => void;
    expect(handler).toBeTypeOf('function');
    handler(erro, info);

    expect(espiaoErro).toHaveBeenCalledTimes(1);
    expect(espiaoErro).toHaveBeenCalledWith(MENSAGEM_ERRO_RAIZ);
    const texto = JSON.stringify(espiaoErro.mock.calls);
    expect(texto).not.toContain('sk-teste-123');
    expect(texto).not.toContain('529.982.247-25');
    expect(texto).not.toContain('Segredo');
    expect(espiaoAviso).not.toHaveBeenCalled();
    expect(espiaoLog).not.toHaveBeenCalled();
  });
});

describe('createRoot com OPCOES_RAIZ', () => {
  it('componente que lança: o console recebe só a mensagem fixa', async () => {
    function Quebrado(): never {
      throw new Error('falhou com sk-teste-123 e 529.982.247-25');
    }
    // Fora do `act`: o React entrega o erro aos handlers da raiz, como no app real.
    const raiz = createRoot(document.createElement('div'), OPCOES_RAIZ);
    raiz.render(<Quebrado />);
    await vi.waitFor(() => {
      expect(espiaoErro).toHaveBeenCalledWith(MENSAGEM_ERRO_RAIZ);
    });
    raiz.unmount();

    const saidas = JSON.stringify([
      ...espiaoErro.mock.calls,
      ...espiaoAviso.mock.calls,
      ...espiaoLog.mock.calls,
    ]);
    expect(espiaoErro).toHaveBeenCalledTimes(1);
    expect(saidas).not.toContain('sk-teste-123');
    expect(saidas).not.toContain('529.982.247-25');
    expect(saidas).not.toContain('Quebrado');
    expect(espiaoAviso).not.toHaveBeenCalled();
    expect(espiaoLog).not.toHaveBeenCalled();
  });
});
