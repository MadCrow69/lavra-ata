import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErroProvedor, erroProvedor } from '../../ai/errors';
import { KeysProvider, useKeys } from '../../ai/KeysContext';
import { criarKeyStore } from '../../ai/keys';
import type { ProviderAdapter, ProviderId } from '../../ai/types';
import { erroSemCredito } from '../../ai/providers/comum';
import { MODELOS, URL_CHAVE } from '../../config/models';
import { CHAVES } from '../../config/storage-keys';
import { PreferenciasProvider } from '../../preferencias/PreferenciasContext';
import {
  criarPreferenciasStore,
  type PreferenciasStore,
} from '../../preferencias/preferencias-store';
import { KeysModal } from './KeysModal';

const CHAVE = 'sk-teste-ficticia-9f3a7c21';
const CHAVE_2 = 'AIzaTesteFicticia8b4d6e10';

function storageFalso() {
  const dados = new Map<string, string>();
  const storage = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => {
      dados.set(k, v);
    },
    removeItem: (k: string) => {
      dados.delete(k);
    },
    clear: () => {
      dados.clear();
    },
    key: () => null,
    get length() {
      return dados.size;
    },
  } satisfies Storage;
  return { storage, dados };
}

type Testar = (cfg: { id: ProviderId; chave: string }, signal: AbortSignal) => Promise<void>;

function adaptador(id: ProviderId, testar?: Testar): ProviderAdapter {
  return {
    id,
    rotulo: id,
    gerar: vi.fn(),
    testarChave: vi.fn(testar ?? (() => Promise.resolve())),
  };
}

function adaptadoresCom(
  testar?: Partial<Record<ProviderId, Testar>>,
): Record<ProviderId, ProviderAdapter> {
  return {
    openai: adaptador('openai', testar?.openai),
    gemini: adaptador('gemini', testar?.gemini),
    anthropic: adaptador('anthropic', testar?.anthropic),
  };
}

function Resumo() {
  const { cadeia } = useKeys();
  return (
    <output data-testid="cadeia">
      {cadeia()
        .map((c) => `${c.id}:${c.modelo}`)
        .join('|')}
    </output>
  );
}

function Host({
  adaptadores,
  onFechar,
}: {
  adaptadores: Record<ProviderId, ProviderAdapter>;
  onFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
        }}
      >
        Abrir chaves
      </button>
      <KeysModal
        aberto={aberto}
        adaptadores={adaptadores}
        onFechar={() => {
          onFechar?.();
          setAberto(false);
        }}
      />
      <Resumo />
    </>
  );
}

async function montar(
  opcoes: {
    testar?: Partial<Record<ProviderId, Testar>>;
    onFechar?: () => void;
    storage?: Storage;
    preferencias?: PreferenciasStore;
  } = {},
) {
  const user = userEvent.setup();
  const fake = storageFalso();
  const store = criarKeyStore(opcoes.storage ?? fake.storage);
  const adaptadores = adaptadoresCom(opcoes.testar);
  render(
    <PreferenciasProvider store={opcoes.preferencias ?? criarPreferenciasStore(null, null)}>
      <KeysProvider store={store}>
        <Host
          adaptadores={adaptadores}
          {...(opcoes.onFechar ? { onFechar: opcoes.onFechar } : {})}
        />
      </KeysProvider>
    </PreferenciasProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Abrir chaves' }));
  return { user, store, adaptadores, ...fake };
}

const cartao = (nome: string) => screen.getByRole('region', { name: nome });
const campoChave = (nome: string) => within(cartao(nome)).getByLabelText('Chave de API');

describe('KeysModal', () => {
  it('mostra o aviso de privacidade, um cartão por provedor e "Lembrar" desmarcado', async () => {
    await montar();
    expect(screen.getByRole('dialog', { name: 'Chaves de IA' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Suas chaves ficam só neste navegador e vão direto para o provedor escolhido. Nenhum servidor do Lavra recebe nada.',
      ),
    ).toBeInTheDocument();
    for (const nome of ['OpenAI', 'Google Gemini', 'Anthropic']) {
      const c = cartao(nome);
      const campo = within(c).getByLabelText('Chave de API');
      expect(campo).toHaveAttribute('type', 'password');
      expect(campo).toHaveAttribute('autocomplete', 'off');
      expect(campo).toHaveAttribute('spellcheck', 'false');
    }
    expect(screen.getByRole('checkbox', { name: 'Lembrar neste navegador' })).not.toBeChecked();
    expect(
      screen.getByText(
        'A chave ficará salva neste navegador. Qualquer extensão ou pessoa com acesso a ele poderá lê-la. Prefira uma chave com limite de gasto.',
      ),
    ).toBeInTheDocument();
  });

  it('mostrar/ocultar a chave alterna o tipo do campo e o rótulo do botão', async () => {
    const { user } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Mostrar chave de OpenAI' }));
    expect(campoChave('OpenAI')).toHaveAttribute('type', 'text');
    expect(campoChave('OpenAI')).toHaveValue(CHAVE);
    await user.click(screen.getByRole('button', { name: 'Ocultar chave de OpenAI' }));
    expect(campoChave('OpenAI')).toHaveAttribute('type', 'password');
  });

  it('a chave digitada vai para a cadeia, mas nunca para storage sem "Lembrar", console nem DOM fora do campo', async () => {
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) =>
      vi.spyOn(console, metodo).mockImplementation(() => undefined),
    );
    const { user, store, dados } = await montar({
      testar: { openai: () => Promise.reject(erroProvedor('limite', 'openai')) },
    });
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Mostrar chave de OpenAI' }));
    await user.type(campoChave('Google Gemini'), CHAVE_2);

    expect(store.cadeia().map((c) => c.chave)).toEqual([CHAVE, CHAVE_2]);
    expect(dados.size).toBe(0);

    // Testar (com falha) e trocar a ordem também não podem vazar a chave.
    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    await screen.findByText(/atingiu o limite de uso/);
    await user.click(screen.getByRole('button', { name: 'Mover OpenAI para baixo' }));
    expect(dados.size).toBe(0);
    for (const espiao of consoles) {
      expect(JSON.stringify(espiao.mock.calls)).not.toContain(CHAVE);
      expect(JSON.stringify(espiao.mock.calls)).not.toContain(CHAVE_2);
    }
    vi.restoreAllMocks();

    const camposDeChave = new Set<Element>([campoChave('OpenAI'), campoChave('Google Gemini')]);
    expect(document.body.textContent).not.toContain(CHAVE);
    expect(document.body.textContent).not.toContain(CHAVE_2);
    for (const el of document.body.querySelectorAll('*')) {
      if (camposDeChave.has(el)) continue;
      for (const attr of el.getAttributeNames()) {
        const valor = el.getAttribute(attr) ?? '';
        expect(valor).not.toContain(CHAVE);
        expect(valor).not.toContain(CHAVE_2);
      }
    }
  });

  it('Testar: fica desabilitado e "Testando…" enquanto roda; chave aceita mostra "Chave válida"', async () => {
    let resolver: () => void = () => undefined;
    const { user, adaptadores } = await montar({
      testar: {
        openai: () =>
          new Promise<void>((resolve) => {
            resolver = resolve;
          }),
      },
    });
    const c = cartao('OpenAI');
    expect(within(c).getByRole('button', { name: 'Testar chave de OpenAI' })).toBeDisabled();
    await user.type(campoChave('OpenAI'), `  ${CHAVE}  `);
    await user.click(within(c).getByRole('button', { name: 'Testar chave de OpenAI' }));

    const ocupado = within(c).getByRole('button', { name: /Testando/ });
    expect(ocupado).toHaveAttribute('aria-disabled', 'true');
    expect(ocupado).toHaveTextContent('Testando…');
    // O método é um vi.fn() isolado do objeto: não depende de `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(adaptadores.openai.testarChave).toHaveBeenCalledWith(
      { id: 'openai', chave: CHAVE },
      expect.any(AbortSignal),
    );

    resolver();
    expect(await within(c).findByText('Chave válida')).toBeInTheDocument();
    expect(within(c).getByRole('button', { name: 'Testar chave de OpenAI' })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('chave recusada mostra "Chave inválida: verifique se copiou a chave inteira"', async () => {
    const { user } = await montar({
      testar: {
        gemini: () => Promise.reject(erroProvedor('chave_invalida', 'gemini', { status: 400 })),
      },
    });
    await user.type(campoChave('Google Gemini'), CHAVE_2);
    await user.click(screen.getByRole('button', { name: 'Testar chave de Google Gemini' }));
    expect(
      await within(cartao('Google Gemini')).findByText(
        'Chave inválida: verifique se copiou a chave inteira',
      ),
    ).toBeInTheDocument();
    expect(within(cartao('Google Gemini')).queryByText('Chave válida')).not.toBeInTheDocument();
  });

  it('conta sem crédito mostra a mensagem de saldo, não "verifique se copiou a chave inteira"', async () => {
    const { user } = await montar({
      testar: { openai: () => Promise.reject(erroSemCredito('openai', 429)) },
    });
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    const c = cartao('OpenAI');
    expect(await within(c).findByText(/sem crédito ou saldo/)).toBeInTheDocument();
    expect(within(c).queryByText(/verifique se copiou/)).not.toBeInTheDocument();
  });

  it('sem saldo: trocar o modelo mantém a mensagem de saldo; digitar outra chave a limpa', async () => {
    const { user, store } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    // Como a geração faz ao receber 429 insufficient_quota (ver o teste do Workbench).
    act(() => {
      store.definirEstado('openai', CHAVE, 'invalida', true);
    });
    const c = cartao('OpenAI');
    expect(within(c).getByText(/sem crédito ou saldo/)).toBeInTheDocument();

    await user.selectOptions(
      within(c).getByLabelText('Modelo'),
      within(c).getByRole('option', { name: 'Outro modelo…' }),
    );
    await user.type(within(c).getByLabelText('Id do modelo'), 'modelo-digitado');
    expect(store.listar()[0]).toMatchObject({ modelo: 'modelo-digitado', semCredito: true });
    expect(within(c).getByText(/sem crédito ou saldo/)).toBeInTheDocument();

    await user.type(campoChave('OpenAI'), '9');
    expect(within(c).queryByText(/sem crédito ou saldo/)).not.toBeInTheDocument();
    expect(store.listar()[0]?.semCredito).toBeUndefined();
  });

  it('erro de rede/limite mostra a mensagem do provedor, não "chave inválida"; texto com a chave é limpo', async () => {
    const { user } = await montar({
      testar: {
        openai: () => Promise.reject(erroProvedor('rede', 'openai')),
        anthropic: () => Promise.reject(new Error(`falha com ${CHAVE_2} no meio`)),
      },
    });
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    expect(
      await within(cartao('OpenAI')).findByText(/recusou a chamada direta do navegador/),
    ).toBeInTheDocument();
    expect(within(cartao('OpenAI')).queryByText(/Chave inválida/)).not.toBeInTheDocument();

    await user.type(campoChave('Anthropic'), CHAVE_2);
    await user.click(screen.getByRole('button', { name: 'Testar chave de Anthropic' }));
    expect(
      await within(cartao('Anthropic')).findByText(/Não foi possível testar a chave/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(CHAVE_2);
    expect(within(cartao('Anthropic')).queryByText(/Chave inválida/)).not.toBeInTheDocument();
  });

  it('ErroProvedor cuja mensagem traz a chave: o status mostra a mensagem sem a chave', async () => {
    const { user } = await montar({
      testar: {
        openai: () =>
          Promise.reject(
            new ErroProvedor('inesperado', 'openai', `Recusou a chave ${CHAVE} agora.`),
          ),
      },
    });
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    expect(
      await within(cartao('OpenAI')).findByText('Recusou a chave [chave removida] agora.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(CHAVE);
  });

  it('trocar o modelo durante o teste não é desfeito quando o teste termina', async () => {
    let resolver: () => void = () => undefined;
    const { user, store } = await montar({
      testar: {
        openai: () =>
          new Promise<void>((resolve) => {
            resolver = resolve;
          }),
      },
    });
    const c = cartao('OpenAI');
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(within(c).getByRole('button', { name: 'Testar chave de OpenAI' }));

    await user.selectOptions(within(c).getByLabelText('Modelo'), 'gpt-6.1-sol');
    expect(store.cadeia()[0]?.modelo).toBe('gpt-6.1-sol');
    resolver();
    expect(await within(c).findByText('Chave válida')).toBeInTheDocument();
    expect(store.cadeia()[0]?.modelo).toBe('gpt-6.1-sol');
    expect(within(c).getByLabelText('Modelo')).toHaveValue('gpt-6.1-sol');

    // Também com id livre digitado durante o teste.
    await user.selectOptions(within(c).getByLabelText('Modelo'), 'gpt-6-luna');
    await user.click(within(c).getByRole('button', { name: 'Testar chave de OpenAI' }));
    await user.selectOptions(
      within(c).getByLabelText('Modelo'),
      within(c).getByRole('option', { name: 'Outro modelo…' }),
    );
    await user.type(within(c).getByLabelText('Id do modelo'), 'modelo-digitado');
    resolver();
    await within(c).findByText('Chave válida');
    expect(store.cadeia()[0]?.modelo).toBe('modelo-digitado');
  });

  it('chave recusada sai da cadeia (continua no cartão com o motivo); editar a chave a devolve', async () => {
    const { user, store } = await montar({
      testar: {
        openai: () => Promise.reject(erroProvedor('chave_invalida', 'openai', { status: 401 })),
      },
    });
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.type(campoChave('Google Gemini'), CHAVE_2);
    expect(store.cadeia().map((c) => c.id)).toEqual(['openai', 'gemini']);

    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    expect(
      await within(cartao('OpenAI')).findByText(
        'Chave inválida: verifique se copiou a chave inteira',
      ),
    ).toBeInTheDocument();
    expect(store.cadeia().map((c) => c.id)).toEqual(['gemini']);
    expect(screen.getByTestId('cadeia')).toHaveTextContent(/^gemini:/);
    expect(screen.getByTestId('cadeia')).not.toHaveTextContent('openai');

    await user.type(campoChave('OpenAI'), '9');
    expect(within(cartao('OpenAI')).queryByText(/Chave inválida/)).not.toBeInTheDocument();
    expect(store.cadeia().map((c) => c.id)).toEqual(['openai', 'gemini']);
  });

  it('navegador que bloqueia o armazenamento: "Lembrar" não liga e o aviso aparece', async () => {
    const bloqueado = {
      getItem: () => null,
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage;
    const { user, store } = await montar({ storage: bloqueado });
    const aviso = 'Este navegador bloqueou o armazenamento; a chave fica só nesta aba.';
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();

    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('checkbox', { name: 'Lembrar neste navegador' }));
    expect(screen.getByRole('checkbox', { name: 'Lembrar neste navegador' })).not.toBeChecked();
    expect(screen.getByText(aviso)).toBeInTheDocument();
    expect(store.cadeia()).toHaveLength(1);
  });

  it('editar a chave depois de testar zera o veredito', async () => {
    const { user } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    expect(await screen.findByText('Chave válida')).toBeInTheDocument();
    await user.type(campoChave('OpenAI'), 'x');
    expect(screen.queryByText('Chave válida')).not.toBeInTheDocument();
  });

  it('Esc fecha o modal e cancela um teste em andamento', async () => {
    const onFechar = vi.fn();
    let sinal: AbortSignal | undefined;
    const { user } = await montar({
      onFechar,
      testar: {
        openai: (_cfg, signal) => {
          sinal = signal;
          return new Promise<void>(() => undefined);
        },
      },
    });
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('button', { name: 'Testar chave de OpenAI' }));
    expect(sinal?.aborted).toBe(false);
    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sinal?.aborted).toBe(true);
  });

  it('modelo: marca o padrão, troca por outro da lista e aceita id livre (aparado)', async () => {
    const { user, store } = await montar();
    const c = cartao('OpenAI');
    await user.type(campoChave('OpenAI'), CHAVE);
    const seletor = within(c).getByLabelText('Modelo');

    const rotuloPadrao = within(c).getByRole('option', { name: /GPT-6 Luna/ });
    expect(rotuloPadrao).toHaveTextContent('GPT-6 Luna (padrão, mais econômico)');
    expect(seletor).toHaveValue(MODELOS.openai.padrao);

    await user.selectOptions(seletor, 'gpt-6.1-sol');
    expect(store.cadeia()[0]?.modelo).toBe('gpt-6.1-sol');

    await user.selectOptions(seletor, within(c).getByRole('option', { name: 'Outro modelo…' }));
    const livre = within(c).getByLabelText('Id do modelo');
    await user.type(livre, '  meu-modelo-novo ');
    expect(store.cadeia()[0]?.modelo).toBe('meu-modelo-novo');
  });

  it('modelo escolhido antes de digitar a chave é mantido', async () => {
    const { user, store } = await montar();
    await user.selectOptions(
      within(cartao('Anthropic')).getByLabelText('Modelo'),
      'claude-opus-5-5',
    );
    await user.type(campoChave('Anthropic'), 'sk-ant-teste-ficticia-77');
    expect(store.cadeia()[0]).toMatchObject({ id: 'anthropic', modelo: 'claude-opus-5-5' });
  });

  it('Apagar remove só a chave daquele cartão', async () => {
    const { user, store } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.type(campoChave('Google Gemini'), CHAVE_2);
    await user.click(screen.getByRole('button', { name: 'Apagar chave de OpenAI' }));
    expect(campoChave('OpenAI')).toHaveValue('');
    expect(campoChave('OpenAI')).toHaveFocus();
    expect(store.cadeia().map((c) => c.id)).toEqual(['gemini']);
  });

  it('setas ↑/↓ mudam a ordem de preferência, mantêm o foco no botão e anunciam a nova ordem', async () => {
    const { user, store } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.type(campoChave('Google Gemini'), CHAVE_2);

    await user.click(screen.getByRole('button', { name: 'Mover Google Gemini para cima' }));
    expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);
    expect(screen.getByRole('button', { name: 'Mover Google Gemini para cima' })).toHaveFocus();
    expect(screen.getByTestId('cadeia')).toHaveTextContent(/^gemini:.*\|openai:/);
    expect(
      screen.getByText('Nova ordem de preferência: Google Gemini, OpenAI, Anthropic.'),
    ).toBeInTheDocument();
    // Na ponta, o botão não faz nada e continua focável.
    await user.click(screen.getByRole('button', { name: 'Mover Google Gemini para cima' }));
    expect(store.ordem()).toEqual(['gemini', 'openai', 'anthropic']);

    // Teclado: Enter e Espaço.
    const baixo = screen.getByRole('button', { name: 'Mover Google Gemini para baixo' });
    baixo.focus();
    await user.keyboard('{Enter}');
    expect(store.ordem()).toEqual(['openai', 'gemini', 'anthropic']);
    expect(screen.getByRole('button', { name: 'Mover Google Gemini para baixo' })).toHaveFocus();
    await user.keyboard(' ');
    expect(store.ordem()).toEqual(['openai', 'anthropic', 'gemini']);
    expect(screen.getByRole('button', { name: 'Mover Google Gemini para baixo' })).toHaveFocus();
    expect(
      screen.getByText('Nova ordem de preferência: OpenAI, Anthropic, Google Gemini.'),
    ).toBeInTheDocument();
  });

  it('"Lembrar neste navegador": marcar grava em CHAVES, desmarcar apaga na hora', async () => {
    const { user, dados, store } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar neste navegador' });

    await user.click(caixa);
    expect(caixa).toBeChecked();
    expect(dados.get(CHAVES)).toContain(CHAVE);

    await user.click(caixa);
    expect(caixa).not.toBeChecked();
    expect(dados.has(CHAVES)).toBe(false);
    expect(store.cadeia()).toHaveLength(1);
  });

  it('"Apagar todas as chaves" pede confirmação; cancelar não apaga, confirmar limpa tudo', async () => {
    const { user, store, dados } = await montar();
    await user.type(campoChave('OpenAI'), CHAVE);
    await user.click(screen.getByRole('checkbox', { name: 'Lembrar neste navegador' }));

    await user.click(screen.getByRole('button', { name: 'Apagar todas as chaves' }));
    const confirmacao = screen.getByRole('dialog', { name: 'Apagar todas as chaves?' });
    await user.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('dialog', { name: 'Apagar todas as chaves?' }),
    ).not.toBeInTheDocument();
    expect(store.cadeia()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Apagar todas as chaves' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Apagar todas as chaves?' })).getByRole('button', {
        name: 'Apagar tudo',
      }),
    );
    expect(store.cadeia()).toEqual([]);
    expect(dados.has(CHAVES)).toBe(false);
    expect(campoChave('OpenAI')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Lembrar neste navegador' })).not.toBeChecked();
    expect(screen.getByRole('dialog', { name: 'Chaves de IA' })).toBeInTheDocument();
  });

  it('abrir de novo restaura chave e modelo (inclusive id livre) do store', async () => {
    const user = userEvent.setup();
    const fake = storageFalso();
    const antes = criarKeyStore(fake.storage);
    antes.definirLembrar(true);
    antes.definir({
      provedor: 'openai',
      chave: CHAVE,
      modelo: 'modelo-livre-1',
      estado: 'nao_testada',
    });
    const store = criarKeyStore(fake.storage);
    render(
      <PreferenciasProvider store={criarPreferenciasStore(null, null)}>
        <KeysProvider store={store}>
          <Host adaptadores={adaptadoresCom()} />
        </KeysProvider>
      </PreferenciasProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Abrir chaves' }));
    expect(campoChave('OpenAI')).toHaveValue(CHAVE);
    expect(within(cartao('OpenAI')).getByLabelText('Id do modelo')).toHaveValue('modelo-livre-1');
    expect(screen.getByRole('checkbox', { name: 'Lembrar neste navegador' })).toBeChecked();
  });

  describe('preferências lembradas', () => {
    it('mover Anthropic para cima grava a ordem nas preferências', async () => {
      const preferencias = criarPreferenciasStore(null, null);
      const { user } = await montar({ preferencias });
      await user.click(screen.getByRole('button', { name: 'Mover Anthropic para cima' }));
      expect(preferencias.atual().ordem).toEqual(['openai', 'anthropic', 'gemini']);
    });

    it('trocar o modelo grava modelos.openai (e só ele)', async () => {
      const preferencias = criarPreferenciasStore(null, null);
      const { user } = await montar({ preferencias });
      const escolha = MODELOS.openai.opcoes.find((o) => o.id !== MODELOS.openai.padrao);
      expect(escolha).toBeDefined();
      await user.selectOptions(
        within(cartao('OpenAI')).getByLabelText('Modelo'),
        escolha?.id ?? '',
      );
      expect(preferencias.atual().modelos).toEqual({ openai: escolha?.id });
    });

    it('id livre digitado também é lembrado, aparado', async () => {
      const preferencias = criarPreferenciasStore(null, null);
      const { user } = await montar({ preferencias });
      await user.selectOptions(within(cartao('OpenAI')).getByLabelText('Modelo'), 'Outro modelo…');
      await user.type(within(cartao('OpenAI')).getByLabelText('Id do modelo'), ' meu-modelo ');
      expect(preferencias.atual().modelos).toEqual({ openai: 'meu-modelo' });
    });

    it('cartão sem chave abre com o modelo lembrado', async () => {
      const preferencias = criarPreferenciasStore(null, null);
      const lembrado = MODELOS.openai.opcoes.find((o) => o.id !== MODELOS.openai.padrao);
      preferencias.definir({ modelos: { openai: lembrado?.id ?? '' } });
      await montar({ preferencias });
      expect(within(cartao('OpenAI')).getByLabelText('Modelo')).toHaveValue(lembrado?.id);
      // Digitar a chave grava com o modelo lembrado, não com o padrão.
      const user = userEvent.setup();
      await user.type(campoChave('OpenAI'), CHAVE);
      expect(screen.getByTestId('cadeia')).toHaveTextContent(`openai:${lembrado?.id ?? ''}`);
    });

    it('modelo lembrado fora da lista abre em "Outro modelo…" com o id no campo', async () => {
      const preferencias = criarPreferenciasStore(null, null);
      preferencias.definir({ modelos: { openai: 'modelo-livre-9' } });
      await montar({ preferencias });
      expect(within(cartao('OpenAI')).getByLabelText('Modelo')).toHaveDisplayValue('Outro modelo…');
      expect(within(cartao('OpenAI')).getByLabelText('Id do modelo')).toHaveValue('modelo-livre-9');
    });

    it('a chave guardada vence o modelo lembrado', async () => {
      const preferencias = criarPreferenciasStore(null, null);
      preferencias.definir({ modelos: { openai: 'modelo-livre-9' } });
      const fake = storageFalso();
      const antes = criarKeyStore(fake.storage);
      antes.definirLembrar(true);
      antes.definir({
        provedor: 'openai',
        chave: CHAVE,
        modelo: MODELOS.openai.padrao,
        estado: 'nao_testada',
      });
      await montar({ preferencias, storage: fake.storage });
      expect(within(cartao('OpenAI')).getByLabelText('Modelo')).toHaveValue(MODELOS.openai.padrao);
    });
  });

  it('link "Onde conseguir a chave" abre a página oficial em nova aba, com aviso para leitor de tela', async () => {
    await montar();
    for (const [nome, id] of [
      ['OpenAI', 'openai'],
      ['Google Gemini', 'gemini'],
      ['Anthropic', 'anthropic'],
    ] as const) {
      const link = within(cartao(nome)).getByRole('link', { name: /Onde conseguir a chave/ });
      expect(link).toHaveAttribute('href', URL_CHAVE[id]);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveTextContent('(abre em nova aba)');
      expect(link.querySelector('[aria-hidden="true"]')).toHaveTextContent('↗');
    }
  });
});
