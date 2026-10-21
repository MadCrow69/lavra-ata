import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { OperacaoIAProvider, useOperacaoIA } from './OperacaoIA';

function envolver({ children }: { children: ReactNode }) {
  return <OperacaoIAProvider>{children}</OperacaoIAProvider>;
}

describe('OperacaoIA', () => {
  it('começa livre; iniciar devolve um controle e marca a operação', () => {
    const { result } = renderHook(() => useOperacaoIA(), { wrapper: envolver });
    expect(result.current.operacao).toBeNull();
    let controle: AbortController | null = null;
    act(() => {
      controle = result.current.iniciar({ tipo: 'secao', chave: 'resumo' });
    });
    expect(controle).toBeInstanceOf(AbortController);
    expect(result.current.operacao).toEqual({ tipo: 'secao', chave: 'resumo' });
  });

  it('recusa uma segunda operação enquanto há uma em andamento', () => {
    const { result } = renderHook(() => useOperacaoIA(), { wrapper: envolver });
    let segunda: AbortController | null | undefined;
    act(() => {
      result.current.iniciar({ tipo: 'ata' });
      // Mesma rodada de renderização: a recusa não pode depender de re-render.
      segunda = result.current.iniciar({ tipo: 'secao', chave: 'resumo' });
    });
    expect(segunda).toBeNull();
    expect(result.current.operacao).toEqual({ tipo: 'ata' });
  });

  it('concluir libera; concluir de um controle antigo não libera a operação nova', () => {
    const { result } = renderHook(() => useOperacaoIA(), { wrapper: envolver });
    let primeiro: AbortController | null = null;
    act(() => {
      primeiro = result.current.iniciar({ tipo: 'ata' });
    });
    act(() => {
      if (primeiro) result.current.concluir(primeiro);
    });
    expect(result.current.operacao).toBeNull();
    act(() => {
      result.current.iniciar({ tipo: 'secao', chave: 'riscos' });
    });
    act(() => {
      if (primeiro) result.current.concluir(primeiro);
    });
    expect(result.current.operacao).toEqual({ tipo: 'secao', chave: 'riscos' });
  });

  it('cancelar aborta o controle em andamento (e mantém ocupado até concluir)', () => {
    const { result } = renderHook(() => useOperacaoIA(), { wrapper: envolver });
    let controle: AbortController | null = null;
    act(() => {
      controle = result.current.iniciar({ tipo: 'ata' });
    });
    act(() => {
      if (controle) result.current.cancelar(controle);
    });
    expect((controle as AbortController | null)?.signal.aborted).toBe(true);
    expect(result.current.operacao).toEqual({ tipo: 'ata' });
  });

  it('cancelar com o controle de uma operação que já acabou não aborta a atual', () => {
    const { result } = renderHook(() => useOperacaoIA(), { wrapper: envolver });
    let antigo: AbortController | null = null;
    let atual: AbortController | null = null;
    act(() => {
      antigo = result.current.iniciar({ tipo: 'ata' });
    });
    act(() => {
      if (antigo) result.current.concluir(antigo);
    });
    act(() => {
      atual = result.current.iniciar({ tipo: 'secao', chave: 'riscos' });
    });
    act(() => {
      if (antigo) result.current.cancelar(antigo);
    });
    expect((atual as AbortController | null)?.signal.aborted).toBe(false);
  });

  it('desmontar o provedor cancela a operação em andamento', () => {
    let controle: AbortController | null = null;
    function Iniciador() {
      const api = useOperacaoIA();
      return (
        <button
          type="button"
          onClick={() => {
            controle = api.iniciar({ tipo: 'ata' });
          }}
        >
          x
        </button>
      );
    }
    const { getByRole, unmount } = render(
      <OperacaoIAProvider>
        <Iniciador />
      </OperacaoIAProvider>,
    );
    act(() => {
      getByRole('button').click();
    });
    unmount();
    expect((controle as AbortController | null)?.signal.aborted).toBe(true);
  });

  it('usar fora do provedor é um erro explícito', () => {
    expect(() => renderHook(() => useOperacaoIA())).toThrow(/OperacaoIAProvider/);
  });
});
