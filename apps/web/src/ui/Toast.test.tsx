import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DURACAO_TOAST_MS } from '../config/ui';
import { ToastProvider, useToast, type ToastDados } from './Toast';

function Disparador({ dados }: { dados: ToastDados }) {
  const { mostrar } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        mostrar(dados);
      }}
    >
      disparar
    </button>
  );
}

function renderizar(dados: ToastDados = { titulo: 'Ata gerada.' }) {
  render(
    <ToastProvider>
      <Disparador dados={dados} />
    </ToastProvider>,
  );
  const disparar = () => {
    fireEvent.click(screen.getByText('disparar'));
  };
  return { disparar };
}

const regiao = () => screen.getByRole('region', { name: 'Notificações' });

function elementoDoToast(texto: string): HTMLElement {
  const el = screen.getByText(texto).closest<HTMLElement>('[data-toast]');
  if (!el) throw new Error(`Toast "${texto}" não encontrado.`);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('anuncia em região aria-live polite, com título e detalhes como texto', () => {
    const { disparar } = renderizar({
      titulo: 'Ata gerada por Gemini',
      detalhes: ['OpenAI falhou: limite de uso', '<b>não é HTML</b>'],
    });
    expect(regiao()).toHaveAttribute('aria-live', 'polite');
    disparar();
    expect(regiao()).toHaveTextContent('Ata gerada por Gemini');
    expect(screen.getByText('OpenAI falhou: limite de uso')).toBeVisible();
    expect(screen.getByText('<b>não é HTML</b>')).toBeVisible();
    expect(regiao().querySelector('b')).toBeNull();
  });

  it('some sozinho depois do tempo padrão', () => {
    const { disparar } = renderizar();
    disparar();
    act(() => {
      vi.advanceTimersByTime(DURACAO_TOAST_MS - 1);
    });
    expect(screen.getByText('Ata gerada.')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Ata gerada.')).not.toBeInTheDocument();
  });

  it('pausa enquanto o mouse está em cima ou o foco está dentro, e retoma depois', () => {
    const { disparar } = renderizar();
    disparar();
    const toast = elementoDoToast('Ata gerada.');
    act(() => {
      vi.advanceTimersByTime(DURACAO_TOAST_MS / 2);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(DURACAO_TOAST_MS * 3);
    });
    expect(screen.getByText('Ata gerada.')).toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button', { name: 'Fechar notificação' }));
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(DURACAO_TOAST_MS * 3);
    });
    expect(screen.getByText('Ata gerada.')).toBeInTheDocument();
    fireEvent.blur(screen.getByRole('button', { name: 'Fechar notificação' }));
    act(() => {
      vi.advanceTimersByTime(DURACAO_TOAST_MS / 2 - 1);
    });
    expect(screen.getByText('Ata gerada.')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Ata gerada.')).not.toBeInTheDocument();
  });

  it('fecha pelo botão e empilha vários', () => {
    const { disparar } = renderizar();
    disparar();
    disparar();
    expect(screen.getAllByText('Ata gerada.')).toHaveLength(2);
    const [primeiro] = screen.getAllByRole('button', { name: 'Fechar notificação' });
    if (!primeiro) throw new Error('Sem botão de fechar.');
    fireEvent.click(primeiro);
    expect(screen.getAllByText('Ata gerada.')).toHaveLength(1);
  });

  it('fechar pelo botão leva o foco ao próximo toast, ou de volta a quem tinha o foco', () => {
    const { disparar } = renderizar();
    disparar();
    disparar();
    const botoes = () => screen.getAllByRole('button', { name: 'Fechar notificação' });
    const [primeiro, segundo] = botoes();
    if (!primeiro || !segundo) throw new Error('Esperava dois toasts.');
    act(() => {
      primeiro.focus();
    });
    fireEvent.click(primeiro);
    expect(segundo).toHaveFocus();

    const disparador = screen.getByText('disparar');
    act(() => {
      disparador.focus();
    });
    act(() => {
      segundo.focus();
    });
    fireEvent.click(segundo);
    expect(screen.queryByText('Ata gerada.')).not.toBeInTheDocument();
    expect(disparador).toHaveFocus();
  });

  it('useToast fora do provedor é erro de uso', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Disparador dados={{ titulo: 'x' }} />)).toThrow(/ToastProvider/);
    erro.mockRestore();
  });
});
