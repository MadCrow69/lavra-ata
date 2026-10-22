import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { KeysProvider } from '../../ai/KeysContext';
import { criarKeyStore } from '../../ai/keys';
import { corDoDestaque } from '../../config/destaque';
import { PREFERENCIAS } from '../../config/storage-keys';
import { criarLogoStore } from '../../logo/logo-store';
import { PreferenciasProvider } from '../../preferencias/PreferenciasContext';
import { criarPreferenciasStore } from '../../preferencias/preferencias-store';
import { storageFalso } from '../../test/storage-falso';
import { ToastProvider } from '../../ui/Toast';
import { Workbench } from '../workbench/Workbench';
import { AJUDA_LEMBRAR_PREFERENCIAS, AVISO_PREFERENCIAS_BLOQUEADAS } from './LembrarPreferencias';

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

const TIPO_CIPA = /CIPA/;

type Fake = ReturnType<typeof storageFalso>;

function montar({
  sessao = storageFalso(),
  local = storageFalso(),
}: { sessao?: Fake; local?: Fake } = {}) {
  const preferencias = criarPreferenciasStore(sessao.storage, local.storage);
  const utils = render(
    <PreferenciasProvider store={preferencias}>
      <KeysProvider store={criarKeyStore(null)}>
        <ToastProvider>
          <Workbench logo={{ store: criarLogoStore(null, null) }} />
        </ToastProvider>
      </KeysProvider>
    </PreferenciasProvider>,
  );
  return { ...utils, sessao, local, preferencias, user: userEvent.setup() };
}

const folha = () => screen.getByRole('article', { name: 'Prévia da ata' });
const corDaFolha = () => folha().style.getPropertyValue('--cor-folha-destaque');
const gravadoNoLocal = (local: Fake): Record<string, unknown> =>
  JSON.parse(local.itens.get(PREFERENCIAS) ?? '{}') as Record<string, unknown>;

describe('preferências lembradas no bloco 1', () => {
  it('escolher a cor muda a folha na hora e diz o que mudou', async () => {
    const { user } = montar();
    expect(screen.getByRole('radio', { name: 'Grafite (padrão)' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Vinho' }));
    expect(
      await screen.findByText('Cor de destaque: Vinho. A folha, o PDF e o DOCX usam a nova cor.'),
    ).toBeInTheDocument();
    expect(corDaFolha()).toBe(corDoDestaque('vinho'));
    expect(corDaFolha()).toBe(corDoDestaque('vinho'));
    expect(screen.getByRole('radio', { name: 'Vinho' })).toBeChecked();
  });

  it('a legenda e o texto de ajuda da cor existem; o grupo tem os seis rádios', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Cor de destaque da folha' });
    expect(
      within(grupo).getByText('Usada no título e nos títulos de seção da folha, do PDF e do DOCX.'),
    ).toBeInTheDocument();
    expect(within(grupo).getAllByRole('radio')).toHaveLength(6);
  });

  it('escolher a cor sem "Lembrar" não grava no local, só na sessão', async () => {
    const { user, local, sessao } = montar();
    await user.click(screen.getByRole('radio', { name: 'Verde-floresta' }));
    expect(local.itens.has(PREFERENCIAS)).toBe(false);
    expect(JSON.parse(sessao.itens.get(PREFERENCIAS) ?? '{}')).toMatchObject({ destaque: 'verde' });
  });

  it('marcar "Lembrar" grava o atual no local e avisa; o texto de ajuda descreve a caixa', async () => {
    const { user, local } = montar();
    await user.click(screen.getByRole('radio', { name: 'Vinho' }));
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    expect(caixa).toHaveAccessibleDescription(AJUDA_LEMBRAR_PREFERENCIAS);
    await user.click(caixa);
    expect(await screen.findByText('Preferências lembradas neste navegador.')).toBeInTheDocument();
    expect(caixa).toBeChecked();
    expect(gravadoNoLocal(local)).toMatchObject({ versao: 1, destaque: 'vinho', tom: 'formal' });
    expect(screen.getByRole('button', { name: 'Esquecer preferências' })).toBeInTheDocument();
  });

  it('remontar com o mesmo local e a sessão vazia restaura cor, tipo e tom no rascunho novo', async () => {
    const primeira = montar();
    await primeira.user.click(screen.getByRole('radio', { name: TIPO_CIPA }));
    await primeira.user.selectOptions(screen.getByLabelText('Tom da redação'), 'conciso');
    await primeira.user.click(screen.getByRole('radio', { name: 'Vinho' }));
    await primeira.user.click(
      screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' }),
    );
    primeira.unmount();
    sessionStorage.clear();

    montar({ local: primeira.local });
    expect(screen.getByRole('radio', { name: 'Vinho' })).toBeChecked();
    expect(screen.getByRole('radio', { name: TIPO_CIPA })).toBeChecked();
    expect(screen.getByLabelText('Tom da redação')).toHaveValue('conciso');
    expect(corDaFolha()).toBe(corDoDestaque('vinho'));
    expect(
      screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' }),
    ).toBeChecked();
  });

  it('trocar tipo e tom grava nas preferências (com Lembrar ligado, no local)', async () => {
    const { user, local } = montar();
    await user.click(
      screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' }),
    );
    await user.click(screen.getByRole('radio', { name: TIPO_CIPA }));
    await user.selectOptions(screen.getByLabelText('Tom da redação'), 'detalhado');
    expect(gravadoNoLocal(local)).toMatchObject({ tipoId: 'cipa', tom: 'detalhado' });
  });

  it('nunca grava a transcrição nem os participantes, nem no local nem na sessão', async () => {
    const { user, local, sessao } = montar();
    await user.click(
      screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' }),
    );
    await user.click(screen.getByRole('button', { name: 'Colar lista' }));
    await user.type(screen.getByLabelText('Nomes, um por linha'), 'Rosângela Falcão');
    await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
    await user.type(
      screen.getByLabelText(/^Transcrição da reunião/),
      'Fala secretissima do conselho',
    );
    await user.click(screen.getByRole('radio', { name: 'Roxo' }));
    // O conteúdo está mesmo no app (o teste não passa por não ter digitado nada).
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue(
      'Fala secretissima do conselho',
    );
    expect(screen.getAllByText(/Rosângela Falcão/).length).toBeGreaterThan(0);
    for (const { itens } of [local, sessao]) {
      const texto = itens.get(PREFERENCIAS) ?? '';
      expect(texto).not.toBe('');
      expect(texto).not.toContain('Rosângela');
      expect(texto).not.toContain('secretissima');
    }
  });

  it('"Esquecer preferências" apaga do local, avisa e a escolha atual segue valendo', async () => {
    const { user, local } = montar();
    await user.click(screen.getByRole('radio', { name: 'Vinho' }));
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    await user.click(caixa);
    await user.click(screen.getByRole('button', { name: 'Esquecer preferências' }));
    expect(
      await screen.findByText(
        'Preferências apagadas deste navegador. As escolhas atuais continuam valendo nesta aba.',
      ),
    ).toBeInTheDocument();
    expect(local.itens.has(PREFERENCIAS)).toBe(false);
    expect(caixa).not.toBeChecked();
    expect(caixa).toHaveFocus();
    expect(corDaFolha()).toBe(corDoDestaque('vinho'));
    expect(screen.queryByRole('button', { name: 'Esquecer preferências' })).not.toBeInTheDocument();
  });

  it('desmarcar "Lembrar" tem o mesmo efeito de esquecer, com o mesmo aviso', async () => {
    const { user, local } = montar();
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    await user.click(caixa);
    await user.click(caixa);
    expect(
      await screen.findByText(
        'Preferências apagadas deste navegador. As escolhas atuais continuam valendo nesta aba.',
      ),
    ).toBeInTheDocument();
    expect(local.itens.has(PREFERENCIAS)).toBe(false);
  });

  it('armazenamento local bloqueado: alerta exato e a caixa fica desmarcada', async () => {
    const { user } = montar({ local: storageFalso({ recusaGravar: true }) });
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    await user.click(caixa);
    expect(await screen.findByRole('alert')).toHaveTextContent(AVISO_PREFERENCIAS_BLOQUEADAS);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este navegador bloqueou o armazenamento; as preferências valem só nesta aba.',
    );
    expect(caixa).not.toBeChecked();
    expect(screen.queryByText('Preferências lembradas neste navegador.')).not.toBeInTheDocument();
  });

  it('o navegador recusa uma gravação depois de ligado: a caixa desliga e o alerta aparece', async () => {
    const local = storageFalso();
    const { user } = montar({ local });
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    await user.click(caixa);
    expect(caixa).toBeChecked();
    local.storage.setItem = () => {
      throw new DOMException('cheio', 'QuotaExceededError');
    };
    await user.click(screen.getByRole('radio', { name: 'Azul' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(AVISO_PREFERENCIAS_BLOQUEADAS);
    expect(caixa).not.toBeChecked();
    expect(corDaFolha()).toBe(corDoDestaque('azul'));
  });

  it('marcar "Lembrar" de novo depois do alerta com sucesso o remove', async () => {
    const local = storageFalso({ recusaGravar: true });
    const { user } = montar({ local });
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    await user.click(caixa);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    local.storage.setItem = (k, v) => {
      local.itens.set(k, v);
    };
    await user.click(caixa);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(caixa).toBeChecked();
  });

  it('carregar a ata nova ("Nova ata") não regrava as preferências', async () => {
    const { user, local } = montar();
    await user.click(
      screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' }),
    );
    const antes = local.itens.get(PREFERENCIAS);
    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    expect(local.itens.get(PREFERENCIAS)).toBe(antes);
  });
});
