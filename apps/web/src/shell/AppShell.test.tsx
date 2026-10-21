import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeysProvider } from '../ai/KeysContext';
import { SITE } from '../config/site';
import { AppShell } from './AppShell';
import { Footer } from './Footer';

/** Simula a largura da janela: `(min-width: 1024px)` casa só quando `largo`. */
function simularLargura(largo: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: largo,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderizar(onConfigurarChaves = vi.fn()) {
  return render(
    <KeysProvider>
      <AppShell
        editar={<p>conteúdo da bancada</p>}
        documento={<p>conteúdo da folha</p>}
        onConfigurarChaves={onConfigurarChaves}
      />
    </KeysProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell em tela larga', () => {
  it('mostra os dois painéis ao mesmo tempo, sem abas', () => {
    simularLargura(true);
    renderizar();

    expect(screen.getByRole('region', { name: 'Editar' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Documento' })).toBeVisible();
    expect(screen.getByText('conteúdo da bancada')).toBeVisible();
    expect(screen.getByText('conteúdo da folha')).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('cabeçalho tem a marca, o link do repositório e o botão de chaves', async () => {
    simularLargura(true);
    const onConfigurarChaves = vi.fn();
    renderizar(onConfigurarChaves);

    expect(screen.getByText(SITE.nome)).toBeInTheDocument();
    const repo = screen.getByRole('link', { name: /GitHub/ });
    expect(repo).toHaveAttribute('href', SITE.repositorio);
    expect(repo).toHaveAttribute('rel', expect.stringContaining('noopener'));

    await userEvent.click(screen.getByRole('button', { name: 'Configurar chaves de IA' }));
    expect(onConfigurarChaves).toHaveBeenCalledTimes(1);
  });

  it('não oferece botões de funções que ainda não existem', () => {
    simularLargura(true);
    renderizar();

    expect(screen.queryByText(/Ver exemplo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Privacidade/)).not.toBeInTheDocument();
  });

  it('rodapé: autoria com link seguro para o LinkedIn e licença', () => {
    simularLargura(true);
    renderizar();

    const autor = screen.getByRole('link', { name: SITE.autor });
    expect(autor).toHaveAttribute('href', SITE.linkedin);
    expect(autor).toHaveAttribute('target', '_blank');
    expect(autor).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(autor).toHaveAttribute('rel', expect.stringContaining('noreferrer'));

    expect(screen.getByRole('link', { name: 'Código aberto (MIT)' })).toHaveAttribute(
      'href',
      SITE.repositorio,
    );
  });

  it('rodapé: "versão de desenvolvimento" quando o commit é dev', () => {
    simularLargura(true);
    renderizar();

    expect(SITE.commit).toBe('dev');
    expect(screen.getByText('versão de desenvolvimento')).toBeInTheDocument();
  });
});

describe('AppShell em tela estreita', () => {
  it('mostra abas e só o painel Editar no início', () => {
    simularLargura(false);
    renderizar();

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Documento' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tabpanel', { name: 'Editar' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Documento' })).not.toBeInTheDocument();
  });

  it('clicar na aba Documento alterna o painel visível', async () => {
    simularLargura(false);
    renderizar();

    await userEvent.click(screen.getByRole('tab', { name: 'Documento' }));

    expect(screen.getByRole('tab', { name: 'Documento' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Documento' })).toBeVisible();
    expect(screen.getByText('conteúdo da folha')).toBeVisible();
    expect(screen.getByText('conteúdo da bancada')).not.toBeVisible();
  });

  it('a seta → move o foco e a seleção para a próxima aba; ← volta; as pontas dão a volta', async () => {
    simularLargura(false);
    renderizar();
    const editar = screen.getByRole('tab', { name: 'Editar' });
    const documento = screen.getByRole('tab', { name: 'Documento' });

    editar.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(documento).toHaveFocus();
    expect(documento).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(editar).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');
    expect(documento).toHaveFocus();
  });

  it('só a aba selecionada entra na ordem do Tab (roving tabindex)', () => {
    simularLargura(false);
    renderizar();

    expect(screen.getByRole('tab', { name: 'Editar' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Documento' })).toHaveAttribute('tabindex', '-1');
  });

  it('manter o conteúdo do painel oculto montado preserva o que foi digitado', async () => {
    simularLargura(false);
    render(
      <KeysProvider>
        <AppShell
          editar={<input aria-label="campo" />}
          documento={<p>folha</p>}
          onConfigurarChaves={vi.fn()}
        />
      </KeysProvider>,
    );
    await userEvent.type(screen.getByLabelText('campo'), 'texto');
    await userEvent.click(screen.getByRole('tab', { name: 'Documento' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Editar' }));

    expect(screen.getByLabelText('campo')).toHaveValue('texto');
  });
});

describe('Footer', () => {
  it('com commit real, mostra os 7 primeiros caracteres e liga ao commit', () => {
    render(<Footer commit="0123456789abcdef0123456789abcdef01234567" />);

    const versao = screen.getByRole('link', { name: 'versão 0123456' });
    expect(versao).toHaveAttribute(
      'href',
      `${SITE.repositorio}/commit/0123456789abcdef0123456789abcdef01234567`,
    );
    expect(versao).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByText('versão de desenvolvimento')).not.toBeInTheDocument();
  });
});
