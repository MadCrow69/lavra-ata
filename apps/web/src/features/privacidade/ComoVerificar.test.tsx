import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KeysProvider } from '../../ai/KeysContext';
import { criarKeyStore } from '../../ai/keys';
import { ORIGEM_PROVEDOR } from '../../config/models';
import { CAMINHOS_CODIGO, SITE, urlDoCodigo, urlDoCommit } from '../../config/site';
import { Header } from '../../shell/Header';
import { ComoVerificarModal, TITULO_COMO_VERIFICAR } from './ComoVerificar';

/** Consultas restritas à seção (`<section>`) cujo `h3` tem este nome. */
function secaoDe(titulo: string) {
  const secao = screen.getByRole('heading', { name: titulo }).closest('section');
  if (!secao) throw new Error(`Seção "${titulo}" sem <section>.`);
  return within(secao);
}

const SHA = '0123456789abcdef0123456789abcdef01234567';

function renderizarModal(commit?: string) {
  return render(
    <ComoVerificarModal aberto onFechar={vi.fn()} {...(commit === undefined ? {} : { commit })} />,
  );
}

describe('Privacidade: como verificar (modal)', () => {
  it('o botão do cabeçalho abre o diálogo; Esc fecha e o foco volta ao botão', async () => {
    render(
      <KeysProvider store={criarKeyStore(null)}>
        <Header onConfigurarChaves={vi.fn()} />
      </KeysProvider>,
    );
    const botao = screen.getByRole('button', { name: TITULO_COMO_VERIFICAR });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(botao);
    const dialogo = screen.getByRole('dialog', { name: TITULO_COMO_VERIFICAR });
    expect(dialogo).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('o botão Fechar também fecha e devolve o foco', async () => {
    render(
      <KeysProvider store={criarKeyStore(null)}>
        <Header onConfigurarChaves={vi.fn()} />
      </KeysProvider>,
    );
    const botao = screen.getByRole('button', { name: TITULO_COMO_VERIFICAR });
    await userEvent.click(botao);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('lista o host de cada provedor permitido, vindo de ORIGEM_PROVEDOR', () => {
    renderizarModal();
    const hosts = Object.values(ORIGEM_PROVEDOR).map((o) => new URL(o).host);
    expect(hosts).toHaveLength(3);
    const secao = secaoDe('O que sai do navegador');
    for (const host of hosts) {
      expect(secao.getByText(host)).toBeInTheDocument();
    }
  });

  it('com commit real: mostra os 7 primeiros caracteres e liga ao commit', () => {
    renderizarModal(SHA);
    expect(screen.getByText(/publicado pelo GitHub Actions a partir do commit/)).toHaveTextContent(
      /a partir do commit 0123456/,
    );
    const link = screen.getByRole('link', { name: /^0123456/ });
    expect(link).toHaveAttribute('href', urlDoCommit(SHA));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('com commit real: os links de código apontam para o commit publicado', () => {
    renderizarModal(SHA);
    expect(screen.getByRole('link', { name: /^Adaptadores de IA/ })).toHaveAttribute(
      'href',
      `${SITE.repositorio}/tree/${SHA}/apps/web/src/ai/providers`,
    );
    expect(screen.getByRole('link', { name: /^Biblioteca @lavra\/pii-br/ })).toHaveAttribute(
      'href',
      urlDoCodigo(CAMINHOS_CODIGO.piiBr, SHA),
    );
    expect(screen.getByRole('link', { name: /^Definição da CSP no código/ })).toHaveAttribute(
      'href',
      `${SITE.repositorio}/blob/${SHA}/apps/web/csp.config.js`,
    );
  });

  it('em desenvolvimento: avisa e aponta para a main', () => {
    renderizarModal('dev');
    expect(
      screen.getByText('Versão de desenvolvimento: os links abaixo apontam para a branch main.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Adaptadores de IA/ })).toHaveAttribute(
      'href',
      `${SITE.repositorio}/tree/main/apps/web/src/ai/providers`,
    );
    expect(screen.queryByText(/publicado pelo GitHub Actions/)).not.toBeInTheDocument();
  });

  it('indica o site publicado', () => {
    renderizarModal();
    expect(
      screen.getByText(new RegExp(SITE.demo.replaceAll('.', String.raw`\.`))),
    ).toBeInTheDocument();
  });

  it('diz o que não é protegido, sem prometer mais do que faz', () => {
    renderizarModal();
    expect(screen.getByText(/Nomes de pessoas não são mascarados/)).toBeInTheDocument();
    expect(
      screen.getByText(/Informação sensível escrita em linguagem natural/),
    ).toBeInTheDocument();
    expect(screen.getByText(/sob os termos do provedor que você escolheu/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'O modo exemplo não envia nada para IA: o exemplo já vem pronto no site. Só o “Testar” do modal de chaves, se você clicar nele, fala com o provedor, para conferir a sua chave, sem nada do exemplo.',
      ),
    ).toBeInTheDocument();
  });

  it('o passo a passo da aba Rede cita os hosts e o marcador de exemplo', () => {
    renderizarModal();
    const lista = secaoDe('Confira na aba Rede').getByRole('list');
    expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
    expect(lista).toHaveTextContent(
      'api.openai.com, generativelanguage.googleapis.com ou api.anthropic.com',
    );
    expect(lista).toHaveTextContent('[CPF_1]');
  });
});
