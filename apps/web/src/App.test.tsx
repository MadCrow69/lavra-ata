import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { PREFERENCIAS, RASCUNHO } from './config/storage-keys';

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
    // Sem "Lembrar", a chave não foi gravada no navegador; a sessão guarda só o rascunho e as
    // preferências (a ordem recém-escolhida), sem chave (espera o salvamento com debounce
    // acontecer, para a conferência não passar com a sessão vazia).
    await waitFor(
      () => {
        expect(sessionStorage.getItem(RASCUNHO)).not.toBeNull();
      },
      { timeout: 2000 },
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(2);
    expect(JSON.parse(sessionStorage.getItem(PREFERENCIAS) ?? 'null')).toMatchObject({
      ordem: ['gemini', 'openai', 'anthropic'],
    });
    for (const chave of [RASCUNHO, PREFERENCIAS]) {
      const guardado = sessionStorage.getItem(chave) ?? '';
      expect(guardado).not.toContain('sk-teste-ficticia-0002');
      expect(guardado).not.toContain('AIzaTesteFicticia0001');
    }
  });
});
