import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('App', () => {
  it('monta a casca do produto: cabeçalho, painéis Editar e Documento e rodapé', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurar chaves de IA' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documento' })).toBeInTheDocument();
  });

  it('o botão do cabeçalho abre o modal de chaves; o cabeçalho passa a mostrar a ordem de preferência', async () => {
    const user = userEvent.setup();
    render(<App />);
    const botao = screen.getByRole('button', { name: 'Configurar chaves de IA' });
    await user.click(botao);

    const dialogo = screen.getByRole('dialog', { name: 'Chaves de IA' });
    await user.type(
      within(screen.getByRole('region', { name: 'Google Gemini' })).getByLabelText('Chave de API'),
      'AIzaTesteFicticia0001',
    );
    await user.type(
      within(screen.getByRole('region', { name: 'OpenAI' })).getByLabelText('Chave de API'),
      'sk-teste-ficticia-0002',
    );
    await user.click(screen.getByRole('button', { name: 'Mover Google Gemini para cima' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).getByRole('button')).toHaveTextContent('IA: Gemini → OpenAI');
    // Sem "Lembrar", nada foi gravado no navegador.
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
