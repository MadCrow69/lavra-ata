import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LOGO } from '../../config/storage-keys';
import type { LogoDoc } from '../../document/model';
import { AVISO_LOGO_SO_NA_PAGINA, useLogo } from '../../logo/LogoContext';
import { criarLogoStore } from '../../logo/logo-store';
import { ErroDeLogo, LOGO_TAMANHO_MAX_MB_TEXTO, MENSAGEM_ERRO_LOGO } from '../../logo/validar-logo';
import { renderizarComProvedores } from '../../test/provedores';
import { A4Preview } from '../preview/A4Preview';
import { LogoField } from './LogoField';

const LOGO_A: LogoDoc = { dataUrl: 'data:image/png;base64,AAAA', largura: 300, altura: 100 };
const LOGO_B: LogoDoc = { dataUrl: 'data:image/png;base64,QkJC', largura: 200, altura: 200 };

const arquivo = (nome = 'logo.png') =>
  new File([new Uint8Array([1, 2, 3])], nome, { type: 'image/png' });

type Processar = (arquivo: File) => Promise<LogoDoc>;

function renderizar(
  processar: Processar = () => Promise.resolve(LOGO_A),
  { comCampo = true }: { comCampo?: boolean } = {},
) {
  const processarLogo = vi.fn<Processar>(processar);
  const logoStore = criarLogoStore(sessionStorage, localStorage);
  const utils = renderizarComProvedores(
    <>
      {comCampo ? <LogoField /> : null}
      <A4Preview />
    </>,
    { processarLogo, logoStore },
  );
  return { ...utils, processarLogo, logoStore, user: userEvent.setup() };
}

const folha = () => screen.getByRole('article', { name: 'Prévia da ata' });
const campo = () => screen.getByRole('group', { name: 'Logo da organização (opcional)' });

describe('LogoField', () => {
  it('sem logo: botão "Enviar logo", ajuda fixa e nada de miniatura, remover nem lembrar', () => {
    renderizar();
    expect(within(campo()).getByRole('button', { name: 'Enviar logo' })).toBeEnabled();
    expect(campo()).toHaveAccessibleDescription(
      `PNG, JPEG, WebP ou SVG até ${LOGO_TAMANHO_MAX_MB_TEXTO} MB. A logo fica neste navegador e nunca vai para a IA.`,
    );
    expect(within(campo()).queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover logo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('enviar: miniatura, "Remover logo" e "Trocar logo"; a folha troca "Adicionar logo" pela imagem', async () => {
    const { user, processarLogo } = renderizar();
    expect(within(folha()).getByRole('button', { name: 'Adicionar logo' })).toBeVisible();

    await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());

    expect(processarLogo).toHaveBeenCalledTimes(1);
    const miniatura = await within(campo()).findByAltText('Logo da organização');
    expect(miniatura).toHaveAttribute('src', LOGO_A.dataUrl);
    expect(within(campo()).getByRole('button', { name: 'Remover logo' })).toBeVisible();
    expect(within(campo()).getByRole('button', { name: 'Trocar logo' })).toBeVisible();
    expect(within(campo()).queryByRole('button', { name: 'Enviar logo' })).not.toBeInTheDocument();

    const naFolha = within(folha()).getByAltText('Logo da organização');
    expect(naFolha).toHaveAttribute('src', LOGO_A.dataUrl);
    expect(
      within(folha()).queryByRole('button', { name: 'Adicionar logo' }),
    ).not.toBeInTheDocument();
  });

  it('"Adicionar logo" na folha também envia, e o campo do bloco 1 acompanha', async () => {
    const { user, processarLogo } = renderizar();
    await user.upload(screen.getByLabelText('Arquivo da logo (na folha)'), arquivo());
    expect(processarLogo).toHaveBeenCalledTimes(1);
    expect(await within(campo()).findByRole('button', { name: 'Remover logo' })).toBeVisible();
    expect(within(folha()).getByAltText('Logo da organização')).toBeVisible();
  });

  it('"Trocar logo" envia outra imagem e substitui a anterior', async () => {
    const { user, processarLogo } = renderizar();
    await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
    await within(campo()).findByAltText('Logo da organização');

    processarLogo.mockResolvedValueOnce(LOGO_B);
    await user.upload(screen.getByLabelText('Arquivo da nova logo'), arquivo('outra.png'));

    await waitFor(() => {
      expect(within(folha()).getByAltText('Logo da organização')).toHaveAttribute(
        'src',
        LOGO_B.dataUrl,
      );
    });
    expect(within(campo()).getByAltText('Logo da organização')).toHaveAttribute(
      'src',
      LOGO_B.dataUrl,
    );
  });

  it('remover: volta "Enviar logo" e "Adicionar logo" na folha, e limpa o armazenamento', async () => {
    const { user, logoStore } = renderizar();
    await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
    await within(campo()).findByRole('button', { name: 'Remover logo' });
    expect(sessionStorage.getItem(LOGO)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Remover logo' }));

    expect(within(campo()).getByRole('button', { name: 'Enviar logo' })).toBeVisible();
    expect(within(folha()).getByRole('button', { name: 'Adicionar logo' })).toBeVisible();
    expect(screen.queryByAltText('Logo da organização')).not.toBeInTheDocument();
    expect(logoStore.atual()).toBeNull();
    expect(sessionStorage.getItem(LOGO)).toBeNull();
  });

  describe('erros', () => {
    it('ErroDeLogo("grande") mostra a mensagem do tamanho em um alerta e não troca a logo', async () => {
      const { user } = renderizar(() => Promise.reject(new ErroDeLogo('grande')));
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(MENSAGEM_ERRO_LOGO.grande);
      expect(alerta).toHaveTextContent(/2 MB/);
      expect(screen.queryByAltText('Logo da organização')).not.toBeInTheDocument();
      expect(within(campo()).getByRole('button', { name: 'Enviar logo' })).toBeEnabled();
    });

    it('outra exceção vira a mensagem "ilegível": o texto da exceção nunca aparece', async () => {
      const { user } = renderizar(() => Promise.reject(new Error('conteúdo secreto da ata')));
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_ERRO_LOGO.ilegivel);
      expect(screen.queryByText(/conteúdo secreto/)).not.toBeInTheDocument();
    });

    it('com logo, um envio recusado mantém a logo atual e avisa', async () => {
      const { user, processarLogo } = renderizar();
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      await within(campo()).findByAltText('Logo da organização');

      processarLogo.mockRejectedValueOnce(new ErroDeLogo('formato'));
      await user.upload(screen.getByLabelText('Arquivo da nova logo'), arquivo('x.gif'));

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_ERRO_LOGO.formato);
      expect(within(campo()).getByAltText('Logo da organização')).toHaveAttribute(
        'src',
        LOGO_A.dataUrl,
      );
    });

    it('o erro some no envio seguinte', async () => {
      const { user, processarLogo } = renderizar(() => Promise.reject(new ErroDeLogo('vazio')));
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      await screen.findByRole('alert');

      processarLogo.mockResolvedValueOnce(LOGO_A);
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      await within(campo()).findByAltText('Logo da organização');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('enviar pela folha mostra o erro num toast; enviar pelo bloco 1 não duplica', async () => {
      const { user } = renderizar(() => Promise.reject(new ErroDeLogo('grande')));

      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      await screen.findByRole('alert');
      // Só o alerta do campo: sem toast.
      expect(screen.getAllByText(MENSAGEM_ERRO_LOGO.grande)).toHaveLength(1);

      await user.upload(screen.getByLabelText('Arquivo da logo (na folha)'), arquivo());
      await waitFor(() => {
        expect(screen.getAllByText(MENSAGEM_ERRO_LOGO.grande)).toHaveLength(2);
      });
    });

    it('só com a folha na tela (celular: o bloco 1 está em outra aba), o erro vai para o toast', async () => {
      const { user } = renderizar(() => Promise.reject(new ErroDeLogo('proporcao')), {
        comCampo: false,
      });
      await user.upload(screen.getByLabelText('Arquivo da logo (na folha)'), arquivo());
      expect(await screen.findByText(MENSAGEM_ERRO_LOGO.proporcao)).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('enquanto processa: anuncia "Processando a logo…" e desabilita os botões de envio', async () => {
    let concluir: (l: LogoDoc) => void = () => undefined;
    const { user } = renderizar(
      () =>
        new Promise<LogoDoc>((resolver) => {
          concluir = resolver;
        }),
    );
    await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());

    const aviso = await screen.findByText('Processando a logo…');
    expect(aviso.closest('[aria-live="polite"]')).not.toBeNull();
    expect(within(campo()).getByRole('button', { name: 'Enviar logo' })).toBeDisabled();
    expect(within(folha()).getByRole('button', { name: 'Adicionar logo' })).toBeDisabled();

    await act(async () => {
      concluir(LOGO_A);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByText('Processando a logo…')).not.toBeInTheDocument();
    });
    expect(within(campo()).getByAltText('Logo da organização')).toBeVisible();
  });

  it('um envio antigo que termina depois do novo não sobrescreve a logo', async () => {
    const pendentes = new Map<string, (l: LogoDoc) => void>();
    const processarLogo = (a: File) =>
      new Promise<LogoDoc>((resolver) => {
        pendentes.set(a.name, resolver);
      });
    function Sonda() {
      const { logo, enviar } = useLogo();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              void enviar(arquivo('lenta.png'));
              void enviar(arquivo('rapida.png'));
            }}
          >
            enviar dois
          </button>
          <output>{logo?.dataUrl ?? 'sem logo'}</output>
        </>
      );
    }
    const user = userEvent.setup();
    renderizarComProvedores(<Sonda />, { processarLogo });
    await user.click(screen.getByRole('button', { name: 'enviar dois' }));

    await act(async () => {
      pendentes.get('rapida.png')?.(LOGO_B);
      await Promise.resolve();
    });
    await act(async () => {
      pendentes.get('lenta.png')?.(LOGO_A);
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent(LOGO_B.dataUrl);
  });

  describe('Lembrar logo neste navegador', () => {
    it('vem desmarcado; marcar grava no localStorage e desmarcar apaga de lá (a sessão fica)', async () => {
      const { user } = renderizar();
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      const caixa = await screen.findByRole('checkbox', { name: 'Lembrar logo neste navegador' });
      expect(caixa).not.toBeChecked();
      expect(localStorage.getItem(LOGO)).toBeNull();

      await user.click(caixa);
      expect(caixa).toBeChecked();
      expect(localStorage.getItem(LOGO)).toContain(LOGO_A.dataUrl);

      await user.click(caixa);
      expect(caixa).not.toBeChecked();
      expect(localStorage.getItem(LOGO)).toBeNull();
      expect(sessionStorage.getItem(LOGO)).not.toBeNull();
      expect(within(campo()).getByAltText('Logo da organização')).toBeVisible();
    });

    it('navegador que recusa gravar: avisa e a caixa continua desmarcada', async () => {
      const { user } = renderizar();
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      const caixa = await screen.findByRole('checkbox', { name: 'Lembrar logo neste navegador' });

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('cheio', 'QuotaExceededError');
      });
      await user.click(caixa);
      vi.restoreAllMocks();

      expect(caixa).not.toBeChecked();
      expect(await screen.findByRole('status')).toHaveTextContent(
        /Não foi possível lembrar a logo/,
      );
      expect(within(campo()).getByAltText('Logo da organização')).toBeVisible();
    });
  });

  describe('armazenamento', () => {
    it('logo guardada na sessão volta ao montar de novo (recarregar a página)', async () => {
      const primeiro = renderizar();
      await primeiro.user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      await within(campo()).findByAltText('Logo da organização');
      primeiro.unmount();

      renderizar();
      expect(within(campo()).getByAltText('Logo da organização')).toHaveAttribute(
        'src',
        LOGO_A.dataUrl,
      );
      expect(within(folha()).getByAltText('Logo da organização')).toBeVisible();
    });

    it('cota cheia: a logo aparece, o aviso diz que vale só até recarregar e nada é apagado', async () => {
      const { user } = renderizar();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('cheio', 'QuotaExceededError');
      });
      await user.upload(screen.getByLabelText('Arquivo da logo'), arquivo());
      vi.restoreAllMocks();

      expect(await screen.findByRole('status')).toHaveTextContent(AVISO_LOGO_SO_NA_PAGINA);
      expect(AVISO_LOGO_SO_NA_PAGINA).toMatch(/^A logo vale só até recarregar a página/);
      expect(within(campo()).getByAltText('Logo da organização')).toBeVisible();
      expect(within(folha()).getByAltText('Logo da organização')).toBeVisible();
    });
  });
});

describe('useLogo', () => {
  it('lança fora do LogoProvider, com mensagem que diz o que fazer', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Sonda() {
      useLogo();
      return null;
    }
    expect(() => render(<Sonda />)).toThrow('useLogo precisa estar dentro de <LogoProvider>.');
    erro.mockRestore();
  });
});
