import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sobDemanda, useSobDemanda, type ModuloSobDemanda } from './sob-demanda';

interface Modulo {
  texto: string;
}

/** Importação controlada pelo teste: cada chamada devolve uma promessa que o teste resolve. */
function importacaoControlada() {
  const pendentes: { resolver: (m: Modulo) => void; rejeitar: (e: Error) => void }[] = [];
  const mod = sobDemanda(
    () =>
      new Promise<Modulo>((resolver, rejeitar) => {
        pendentes.push({ resolver, rejeitar });
      }),
  );
  return { mod, pendentes };
}

function Tela({ mod }: { mod: ModuloSobDemanda<Modulo> }) {
  const { modulo, falhou, tentarDeNovo } = useSobDemanda(mod);
  if (modulo !== null) return <p>{modulo.texto}</p>;
  if (falhou) {
    return (
      <div role="alert">
        Falhou.
        <button type="button" onClick={tentarDeNovo}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return <p role="status">Carregando…</p>;
}

describe('sobDemanda / useSobDemanda', () => {
  it('carregando → pronto; depois de carregado, o módulo sai na hora (sem nova importação)', async () => {
    const { mod, pendentes } = importacaoControlada();
    const { unmount } = render(<Tela mod={mod} />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    await act(async () => {
      pendentes[0]?.resolver({ texto: 'Pronto' });
      await Promise.resolve();
    });
    expect(await screen.findByText('Pronto')).toBeInTheDocument();
    unmount();
    render(<Tela mod={mod} />);
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(pendentes).toHaveLength(1);
  });

  it('falha → aviso com "Tentar de novo", que importa outra vez', async () => {
    const { mod, pendentes } = importacaoControlada();
    render(<Tela mod={mod} />);
    await act(async () => {
      pendentes[0]?.rejeitar(new Error('offline'));
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(pendentes).toHaveLength(2);
    await act(async () => {
      pendentes[1]?.resolver({ texto: 'Pronto' });
      await Promise.resolve();
    });
    expect(await screen.findByText('Pronto')).toBeInTheDocument();
  });

  it('pré-carga e uso concorrentes compartilham uma importação só', async () => {
    const { mod, pendentes } = importacaoControlada();
    const a = mod.carregar();
    const b = mod.carregar();
    expect(pendentes).toHaveLength(1);
    pendentes[0]?.resolver({ texto: 'x' });
    expect(await a).toBe(await b);
    expect(mod.obter()).toEqual({ texto: 'x' });
  });
});
