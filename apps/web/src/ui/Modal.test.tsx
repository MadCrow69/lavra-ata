import { fireEvent, render, screen } from '@testing-library/react';
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

  it('selecionar texto dentro do painel e soltar sobre o fundo não fecha', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const fundo = screen.getByTestId('modal-fundo');
    fireEvent.mouseDown(screen.getByLabelText('Campo de dentro'));
    fireEvent.click(fundo);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(fundo);
    fireEvent.click(fundo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

function Empilhado() {
  const [externo, setExterno] = useState(false);
  const [interno, setInterno] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setExterno(true);
        }}
      >
        Abrir externo
      </button>
      <Modal
        aberto={externo}
        titulo="Externo"
        onFechar={() => {
          setExterno(false);
        }}
      >
        <button
          type="button"
          onClick={() => {
            setInterno(true);
          }}
        >
          Abrir interno
        </button>
        <Modal
          aberto={interno}
          titulo="Interno"
          onFechar={() => {
            setInterno(false);
          }}
          acoes={<button type="button">Confirmar interno</button>}
        >
          <p>Conteúdo interno</p>
        </Modal>
      </Modal>
    </div>
  );
}

describe('Modal empilhado', () => {
  it('com o interno aberto, o foco fica nele, Tab circula nele e Esc fecha só o interno', async () => {
    const user = userEvent.setup();
    render(<Empilhado />);
    await user.click(screen.getByRole('button', { name: 'Abrir externo' }));
    const abrirInterno = screen.getByRole('button', { name: 'Abrir interno' });
    await user.click(abrirInterno);

    const interno = screen.getByRole('dialog', { name: 'Interno' });
    const externo = screen.getByRole('dialog', { name: 'Externo' });
    expect(interno).toContainElement(document.activeElement as HTMLElement);

    // Tab circula só entre os botões do interno (Fechar e Confirmar interno).
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(interno).toContainElement(document.activeElement as HTMLElement);
    }
    await user.tab({ shift: true });
    expect(interno).toContainElement(document.activeElement as HTMLElement);

    // Foco forçado para o externo volta ao interno.
    abrirInterno.focus();
    expect(interno).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Interno' })).not.toBeInTheDocument();
    expect(externo).toBeInTheDocument();
    expect(abrirInterno).toHaveFocus();

    // Já sem o interno, o externo volta a prender o foco e a responder ao Esc.
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(externo).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir externo' })).toHaveFocus();
  });
});
