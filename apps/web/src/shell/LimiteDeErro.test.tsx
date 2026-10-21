import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { LimiteDeErro } from './LimiteDeErro';

const CPF = '529.982.247-25';

function Explode(): never {
  throw new Error(`falha com dado ${CPF}`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LimiteDeErro', () => {
  it('sem erro, mostra o conteúdo normalmente', () => {
    render(
      <LimiteDeErro>
        <p>Tudo certo</p>
      </LimiteDeErro>,
    );
    expect(screen.getByText('Tudo certo')).toBeInTheDocument();
  });

  it('erro de renderização vira mensagem em pt-BR com o botão de recarregar, sem o texto do erro', async () => {
    // O React registra o erro capturado no console; aqui só interessa a tela.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recarregar = vi.fn();
    render(
      <LimiteDeErro recarregar={recarregar}>
        <Explode />
      </LimiteDeErro>,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('O Lavra encontrou um erro inesperado');
    expect(alerta.textContent).not.toContain(CPF);
    await userEvent.setup().click(
      screen.getByRole('button', {
        name: 'Recarregar a página (o rascunho desta aba está salvo)',
      }),
    );
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});

describe('contexto inseguro', () => {
  it('fora de HTTPS/localhost, o app explica o motivo em vez de quebrar', () => {
    // O jsdom não define `isSecureContext`; o navegador o define como false fora de HTTPS.
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    try {
      render(<App />);
      expect(screen.getByRole('alert')).toHaveTextContent(/precisa ser aberto por HTTPS/);
      expect(screen.queryByRole('region', { name: 'Editar' })).not.toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(window, 'isSecureContext');
    }
  });
});
