import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function Exemplo({ onFechar }: { onFechar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
        }}
      >
        Abrir
      </button>
      <Modal
        aberto={aberto}
        titulo="Título do modal"
        onFechar={() => {
          onFechar?.();
          setAberto(false);
        }}
        acoes={<button type="button">Confirmar</button>}
      >
        <input aria-label="Campo de dentro" />
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('fechado não renderiza nada', () => {
    render(<Exemplo />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre como diálogo modal rotulado pelo título', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialogo = screen.getByRole('dialog', { name: 'Título do modal' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
  });

  it('Esc fecha e o foco volta ao botão de origem', async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    render(<Exemplo onFechar={onFechar} />);
    const origem = screen.getByRole('button', { name: 'Abrir' });
    await user.click(origem);
    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(origem).toHaveFocus();
  });

  it('o botão Fechar tem rótulo acessível e fecha', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    const origem = screen.getByRole('button', { name: 'Abrir' });
    await user.click(origem);
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(origem).toHaveFocus();
  });

  it('Tab e Shift+Tab circulam só dentro do modal', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialogo = screen.getByRole('dialog');
    // Ordem: Fechar, campo, Confirmar. Várias voltas: o foco nunca sai.
    for (let i = 0; i < 7; i++) {
      await user.tab();
      expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    }
    await user.tab({ shift: true });
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    // Do último volta ao primeiro, e do primeiro ao último.
    screen.getByRole('button', { name: 'Confirmar' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
  });

  it('trava a rolagem da página enquanto aberto e a libera ao fechar', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('clicar no fundo fecha; clicar dentro não', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByLabelText('Campo de dentro'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('modal-fundo'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
