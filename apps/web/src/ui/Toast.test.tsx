import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DURACAO_TOAST_MS } from '../config/ui';
import { useState } from 'react';
import { Modal } from './Modal';
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

  describe('com um diálogo aberto', () => {
    function ComDialogo() {
      const { mostrar } = useToast();
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              mostrar({ titulo: 'Exemplo carregado.' });
            }}
          >
            disparar
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(true);
            }}
          >
            abrir
          </button>
          <Modal
            aberto={aberto}
            titulo="Diálogo alto"
            onFechar={() => {
              setAberto(false);
            }}
          >
            <p>conteúdo</p>
          </Modal>
        </>
      );
    }

    function montar() {
      render(
        <ToastProvider>
          <ComDialogo />
        </ToastProvider>,
      );
    }

    it('o aviso vivo some da vista, o tempo não corre e ele volta ao fechar, com o tempo que faltava', () => {
      montar();
      fireEvent.click(screen.getByText('disparar'));
      act(() => {
        vi.advanceTimersByTime(DURACAO_TOAST_MS / 2);
      });
      fireEvent.click(screen.getByText('abrir'));
      expect(screen.getByRole('dialog', { name: 'Diálogo alto' })).toBeInTheDocument();
      // Fora da vista, mas ainda no texto da região: o anúncio já feito não se repete.
      expect(screen.getByText('Exemplo carregado.')).not.toBeVisible();
      expect(regiao()).toHaveTextContent('Exemplo carregado.');

      act(() => {
        vi.advanceTimersByTime(DURACAO_TOAST_MS * 3);
      });
      expect(screen.getByText('Exemplo carregado.')).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Exemplo carregado.')).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(DURACAO_TOAST_MS / 2 - 1);
      });
      expect(screen.getByText('Exemplo carregado.')).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Exemplo carregado.')).not.toBeInTheDocument();
    });

    it('o aviso que chega com o diálogo aberto fica esperando e aparece ao fechar', () => {
      montar();
      fireEvent.click(screen.getByText('abrir'));
      fireEvent.click(screen.getByText('disparar'));
      expect(regiao()).toHaveTextContent('Exemplo carregado.');
      expect(screen.getByText('Exemplo carregado.')).not.toBeVisible();
      act(() => {
        vi.advanceTimersByTime(DURACAO_TOAST_MS * 2);
      });
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.getByText('Exemplo carregado.')).toBeVisible();
    });
  });

  it('useToast fora do provedor é erro de uso', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Disparador dados={{ titulo: 'x' }} />)).toThrow(/ToastProvider/);
    erro.mockRestore();
  });
});
