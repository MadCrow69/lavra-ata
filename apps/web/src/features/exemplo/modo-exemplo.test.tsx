import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cipa } from '../../ata-types/cipa';
import { corporativa } from '../../ata-types/corporativa';
import { KeysProvider } from '../../ai/KeysContext';
import { criarKeyStore, type KeyStore } from '../../ai/keys';
import type { GenerateRequest, ProviderAdapter, ProviderConfig, ProviderId } from '../../ai/types';
import type { LogoDoc } from '../../document/model';
import type { AtaDraft } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { PREFERENCIAS } from '../../config/storage-keys';
import { salvarRascunho } from '../../domain/persistence';
import { MENSAGEM_ERRO_EXEMPLO, type CarregadoresExemplo } from '../../exemplos/carregar';
import { exemplo as exemploCipa } from '../../exemplos/dados/exemplo-cipa';
import { exemplo as exemploCorporativa } from '../../exemplos/dados/exemplo-corporativa';
import { gravarExemploNaSessao, lerExemploDaSessao } from '../../exemplos/sessao';
import type { Exemplo } from '../../exemplos/tipos';
import { criarLogoStore, type LogoStore } from '../../logo/logo-store';
import { PreferenciasProvider } from '../../preferencias/PreferenciasContext';
import {
  criarPreferenciasStore,
  type PreferenciasStore,
} from '../../preferencias/preferencias-store';
import { gerarEEnviar } from '../../test/revisao-envio';
import { storageFalso } from '../../test/storage-falso';
import { ToastProvider } from '../../ui/Toast';
import { AJUDA_LEMBRAR_NO_EXEMPLO, AJUDA_LEMBRAR_PREFERENCIAS } from '../form/LembrarPreferencias';
import { Workbench } from '../workbench/Workbench';
import { MOTIVO_EXEMPLO, MOTIVO_TIPO_NO_EXEMPLO } from './ModoExemplo';

type Gerar = (cfg: ProviderConfig, req: GenerateRequest) => Promise<unknown>;

const CHAVE_OPENAI = 'sk-teste-ficticia-0001';
const CPF = '529.982.247-25';

const TEXTO_BANNER = 'Você está vendo um exemplo — nada foi enviado para IA.';
const AVISO_SUBSTITUIR =
  'O rascunho desta aba (dados, participantes, transcrição e ata gerada) será substituído pelo exemplo. A sua logo é mantida.';
const AVISO_CANCELAR = 'A geração em andamento será cancelada.';
const RECUPERADO = 'Rascunho recuperado desta aba.';

const LOGO_EXEMPLO: LogoDoc = {
  dataUrl: 'data:image/png;base64,ZXhlbXBsbw==',
  largura: 300,
  altura: 100,
};
const LOGO_PESSOA: LogoDoc = {
  dataUrl: 'data:image/png;base64,cGVzc29h',
  largura: 200,
  altura: 100,
};

const exemplosReais: CarregadoresExemplo = {
  cipa: () => Promise.resolve(exemploCipa),
  corporativa: () => Promise.resolve(exemploCorporativa),
};

function adaptadores(gerar: Gerar): Record<ProviderId, ProviderAdapter> {
  const mk = (id: ProviderId): ProviderAdapter => ({
    id,
    rotulo: id,
    gerar,
    testarChave: () => Promise.resolve(),
  });
  return { openai: mk('openai'), gemini: mk('gemini'), anthropic: mk('anthropic') };
}

function comChave(): KeyStore {
  const store = criarKeyStore(null);
  store.definir({ provedor: 'openai', chave: CHAVE_OPENAI, modelo: '', estado: 'ok' });
  return store;
}

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

interface Opcoes {
  gerar?: Gerar;
  store?: KeyStore;
  exemplos?: CarregadoresExemplo;
  logoStore?: LogoStore;
  preferencias?: PreferenciasStore;
}

function renderizar({
  gerar = () => Promise.reject(new Error('não chamar')),
  store,
  exemplos = exemplosReais,
  logoStore,
  preferencias,
}: Opcoes = {}) {
  const espiao = vi.fn<Gerar>(gerar);
  const processar = vi.fn<(arquivo: File) => Promise<LogoDoc>>(() => Promise.resolve(LOGO_EXEMPLO));
  const keyStore = store ?? criarKeyStore(null);
  const arvore = () => (
    <PreferenciasProvider store={preferencias ?? criarPreferenciasStore(null, null)}>
      <KeysProvider store={keyStore}>
        <ToastProvider>
          <Workbench
            opcoesCadeia={{ adaptadores: adaptadores(espiao), esperaRetryMs: 0 }}
            exemplos={exemplos}
            logo={{ store: logoStore ?? criarLogoStore(null, null), processar }}
          />
        </ToastProvider>
      </KeysProvider>
    </PreferenciasProvider>
  );
  const utils = render(arvore());
  return { ...utils, gerar: espiao, processar, user: userEvent.setup() };
}

const folha = () => screen.getByRole('article', { name: 'Prévia da ata' });
const botaoGerar = () => screen.getByRole('button', { name: /Gerar ata/ });
const banner = () => screen.queryByRole('region', { name: 'Modo exemplo' });
const bannerAtivo = () => screen.getByRole('region', { name: 'Modo exemplo' });
const seletor = () => screen.getByRole('dialog', { name: 'Ver um exemplo' });

async function abrirSeletor(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Ver exemplo' }));
  return seletor();
}

async function verExemplo(user: UserEvent, rotulo: string): Promise<void> {
  const dialogo = await abrirSeletor(user);
  await user.click(within(dialogo).getByRole('button', { name: rotulo }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

/** Descrição acessível exata: os ids de `aria-describedby` apontam para estes textos. */
function descricoes(el: HTMLElement): string[] {
  return (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

/** Rascunho completo da reunião corporativa, pronto para gerar. */
function completo(): AtaDraft {
  return {
    ...criarRascunho('corporativa'),
    dados: {
      organizacao: 'Cooperativa Fictícia',
      assunto: 'Reembolsos',
      data: '2026-10-14',
      inicio: '14:30',
      modalidade: 'remota',
    },
    pauta: ['Reembolsos'],
    participantes: [
      {
        id: 'p1',
        nome: 'Ana Souza',
        papel: '',
        presenca: 'presente',
        justificativa: '',
        extras: {},
      },
    ],
    transcricao: `Ana: reembolso ao CPF ${CPF}.`,
  };
}

async function preencherCorporativa(user: UserEvent): Promise<void> {
  await user.type(screen.getByLabelText(/^Organização/), 'Cooperativa Fictícia');
  await user.type(screen.getByLabelText(/^Assunto/), 'Reembolsos');
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText(/^Início/), { target: { value: '14:30' } });
  await user.selectOptions(screen.getByLabelText(/^Modalidade/), 'remota');
  await user.type(screen.getByLabelText(/^Pauta/), 'Reembolsos');
  await user.type(screen.getByLabelText(/^Nome do novo participante/), 'Ana Souza{Enter}');
  await user.click(screen.getByLabelText(/^Transcrição da reunião/));
  await user.paste('Ana: reembolso aprovado.');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('modo exemplo: entrar', () => {
  it('rascunho vazio → "Ver exemplo" → CIPA: folha, banner e toast exatos, nenhum provedor chamado', async () => {
    simularLargura(true);
    const { user, gerar } = renderizar({ store: comChave() });

    const dialogo = await abrirSeletor(user);
    expect(dialogo).toHaveTextContent(
      'Um exemplo completo, com dados e pessoas fictícios e a ata já gerada. Nada é enviado para IA.',
    );
    // Rascunho vazio: nada a perder, nenhum aviso de substituição.
    expect(dialogo).not.toHaveTextContent(AVISO_SUBSTITUIR);
    const opcao = within(dialogo).getByRole('button', { name: cipa.rotulo });
    expect(opcao).toHaveAccessibleDescription(cipa.descricao);
    expect(within(dialogo).getAllByRole('button', { name: /./ }).length).toBeGreaterThanOrEqual(4);

    await user.click(opcao);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(within(folha()).getAllByText(/Metalúrgica Exemplo Ltda\./).length).toBeGreaterThan(0);
    const aviso = banner();
    expect(aviso).not.toBeNull();
    expect(aviso).toHaveTextContent(TEXTO_BANNER);
    expect(aviso).toHaveTextContent(`Exemplo: ${cipa.rotulo}. Dados e pessoas fictícios.`);
    expect(
      screen.getByText(`Exemplo carregado: ${cipa.rotulo}. Nada foi enviado para IA.`),
    ).toBeVisible();
    expect(gerar).not.toHaveBeenCalled();
    expect(lerExemploDaSessao()).toBe('cipa');
  });

  it('no celular, a aba ativa vira "Documento" e o banner fica visível nas duas abas', async () => {
    simularLargura(false);
    const { user } = renderizar();
    await verExemplo(user, cipa.rotulo);

    expect(screen.getByRole('tab', { name: /Documento/ })).toHaveAttribute('aria-selected', 'true');
    expect(banner()).toBeVisible();
    await user.click(screen.getByRole('tab', { name: /Editar/ }));
    expect(banner()).toBeVisible();
  });

  it('rascunho com transcrição: o seletor avisa a substituição; fechar sem escolher não muda nada', async () => {
    simularLargura(true);
    const { user } = renderizar();
    const transcricao = () => screen.getByLabelText(/^Transcrição da reunião/);
    await user.click(transcricao());
    await user.paste('Ana: minha reunião de verdade.');

    let dialogo = await abrirSeletor(user);
    expect(dialogo).toHaveTextContent(AVISO_SUBSTITUIR);
    expect(dialogo).not.toHaveTextContent(AVISO_CANCELAR);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(transcricao()).toHaveValue('Ana: minha reunião de verdade.');
    expect(banner()).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver exemplo' })).toHaveFocus();

    dialogo = await abrirSeletor(user);
    await user.click(within(dialogo).getByRole('button', { name: cipa.rotulo }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(transcricao()).toHaveValue(exemploCipa.transcricao);
  });

  it('carregando: botão escolhido ocupado, os outros parados; fechar descarta a carga (sem troca, sem toast)', async () => {
    simularLargura(true);
    let entregar: (ex: Exemplo) => void = () => undefined;
    const { user } = renderizar({
      exemplos: {
        ...exemplosReais,
        cipa: () =>
          new Promise<Exemplo>((resolve) => {
            entregar = resolve;
          }),
      },
    });
    const dialogo = await abrirSeletor(user);
    await user.click(within(dialogo).getByRole('button', { name: cipa.rotulo }));

    const ocupado = within(dialogo).getByRole('button', { name: new RegExp(cipa.rotulo) });
    expect(ocupado).toHaveAttribute('aria-busy', 'true');
    expect(ocupado).toHaveTextContent('Carregando…');
    expect(within(dialogo).getByRole('button', { name: corporativa.rotulo })).toBeDisabled();

    await user.keyboard('{Escape}');
    await act(async () => {
      entregar(exemploCipa);
      await Promise.resolve();
    });

    expect(banner()).toBeNull();
    expect(within(folha()).queryByText(/Metalúrgica Exemplo Ltda\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Exemplo carregado/)).not.toBeInTheDocument();
    expect(lerExemploDaSessao()).toBeNull();
  });

  it('carregador que rejeita: alerta com a mensagem do app; rascunho igual ao anterior', async () => {
    simularLargura(true);
    const { user } = renderizar({
      exemplos: { ...exemplosReais, cipa: () => Promise.reject(new Error('chunk-x.js 404')) },
    });
    await user.type(screen.getByLabelText(/^Assunto/), 'Reembolsos');

    const dialogo = await abrirSeletor(user);
    await user.click(within(dialogo).getByRole('button', { name: cipa.rotulo }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_ERRO_EXEMPLO);
    expect(dialogo).not.toHaveTextContent('chunk-x.js');
    // Os botões voltam a funcionar (dá para tentar outro tipo).
    expect(within(dialogo).getByRole('button', { name: cipa.rotulo })).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue('Reembolsos');
    expect(banner()).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
  });

  it('geração em andamento: o seletor avisa; escolher aborta o sinal e o resultado tardio nunca cai no exemplo', async () => {
    // Celular: a aba Documento mostraria o progresso de uma geração que ainda segurasse a vez.
    simularLargura(false);
    salvarRascunho(completo());
    let sinal: AbortSignal | null = null;
    let entregar: (v: unknown) => void = () => undefined;
    const { user } = renderizar({
      store: comChave(),
      // Ignora o cancelamento de propósito: o resultado chega mesmo assim.
      gerar: (_cfg, req) => {
        sinal = req.signal;
        return new Promise((resolve) => {
          entregar = resolve;
        });
      },
    });

    await gerarEEnviar(user);
    expect(screen.getByRole('progressbar', { name: 'Gerando a ata' })).toBeVisible();

    const dialogo = await abrirSeletor(user);
    expect(dialogo).toHaveTextContent(AVISO_SUBSTITUIR);
    expect(dialogo).toHaveTextContent(AVISO_CANCELAR);
    await user.click(within(dialogo).getByRole('button', { name: cipa.rotulo }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect((sinal as AbortSignal | null)?.aborted).toBe(true);
    // A vez da IA foi liberada na hora: nada de "Gerando a ata" sobre o exemplo.
    expect(screen.getByRole('tab', { name: /Documento/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await act(async () => {
      entregar({
        secoes: Object.fromEntries(
          corporativa.secoes.map((s) => [
            s.chave,
            [{ tipo: 'paragrafo', texto: 'Resultado tardio.', itens: [] }],
          ]),
        ),
        encaminhamentos: [],
      });
      await Promise.resolve();
    });

    expect(within(folha()).queryByText('Resultado tardio.')).not.toBeInTheDocument();
    expect(within(folha()).getAllByText(/Metalúrgica Exemplo Ltda\./).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ata gerada por/)).not.toBeInTheDocument();
    expect(banner()).not.toBeNull();
  });

  it('carregar o exemplo não grava preferências', async () => {
    simularLargura(true);
    const preferencias = criarPreferenciasStore(null, null);
    const definir = vi.spyOn(preferencias, 'definir');
    const { user } = renderizar({ preferencias });
    await verExemplo(user, cipa.rotulo);
    await verExemplo(user, corporativa.rotulo);
    expect(definir).not.toHaveBeenCalled();
  });
});

describe('modo exemplo: IA parada', () => {
  it('com chave: Gerar, Regerar e Ajustar parados com o motivo; Baixar PDF livre; nenhum provedor chamado', async () => {
    simularLargura(true);
    const { user, gerar } = renderizar({ store: comChave() });
    await verExemplo(user, cipa.rotulo);

    expect(botaoGerar()).toBeDisabled();
    expect(descricoes(botaoGerar())).toEqual([MOTIVO_EXEMPLO]);
    expect(
      within(screen.getByRole('region', { name: 'Gerar ata' })).getByText(MOTIVO_EXEMPLO),
    ).toBeVisible();

    const regerar = screen.getAllByRole('button', { name: /^Regerar seção/ });
    expect(regerar.length).toBeGreaterThan(0);
    for (const b of regerar) {
      expect(b).toBeDisabled();
      expect(descricoes(b)).toEqual([MOTIVO_EXEMPLO]);
    }
    for (const b of screen.getAllByRole('button', { name: /^Ajustar seção/ })) {
      expect(b).toBeDisabled();
    }
    // Editar à mão segue livre.
    for (const b of screen.getAllByRole('button', { name: /^Editar seção/ })) {
      expect(b).toBeEnabled();
    }
    expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeEnabled();

    await user.click(botaoGerar());
    for (const b of regerar) await user.click(b);
    expect(gerar).not.toHaveBeenCalled();
  });

  it('nos quatro tipos de exemplo, nada chama provedor e o Gerar fica parado', async () => {
    simularLargura(true);
    const { user, gerar } = renderizar({
      store: comChave(),
      exemplos: {
        ...exemplosReais,
        condominio: () => import('../../exemplos/dados/exemplo-condominio').then((m) => m.exemplo),
        'socios-ltda': () =>
          import('../../exemplos/dados/exemplo-socios-ltda').then((m) => m.exemplo),
      },
    });
    for (const rotulo of [
      cipa.rotulo,
      corporativa.rotulo,
      'Condomínio — assembleia geral',
      'Sócios de Ltda — reunião ou assembleia',
    ]) {
      await verExemplo(user, rotulo);
      expect(banner()).toHaveTextContent(`Exemplo: ${rotulo}.`);
      expect(botaoGerar()).toBeDisabled();
    }
    expect(gerar).not.toHaveBeenCalled();
  });

  it('tipo travado: os rádios de tipo ficam parados com o motivo; depois de "Começar a minha", livres', async () => {
    simularLargura(true);
    const { user } = renderizar();
    await verExemplo(user, cipa.rotulo);

    const grupo = screen.getByRole('group', { name: 'Tipo de ata' });
    const radios = within(grupo).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    for (const r of radios) {
      expect(r).toBeDisabled();
      expect(descricoes(r)).toEqual([MOTIVO_TIPO_NO_EXEMPLO]);
    }
    expect(within(grupo).getByText(MOTIVO_TIPO_NO_EXEMPLO)).toBeVisible();

    await user.click(within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }));
    for (const r of within(screen.getByRole('group', { name: 'Tipo de ata' })).getAllByRole(
      'radio',
    )) {
      expect(r).toBeEnabled();
      expect(r).not.toHaveAttribute('aria-describedby');
    }
    expect(screen.queryByText(MOTIVO_TIPO_NO_EXEMPLO)).not.toBeInTheDocument();
  });
});

describe('modo exemplo: sair', () => {
  it('"Começar a minha" sem edição: sem confirmação, formulário vazio, tipo mantido, só o toast do exemplo', async () => {
    simularLargura(true);
    const { user, gerar } = renderizar({ store: comChave() });
    await verExemplo(user, corporativa.rotulo);

    await user.click(within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(banner()).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
    expect(screen.getByLabelText(/^Organização/)).toHaveValue('');
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue('');
    expect(screen.getByRole('radio', { name: new RegExp(corporativa.rotulo) })).toBeChecked();
    expect(
      screen.getByText(
        `Exemplo fechado. O formulário está vazio para a sua ata; o tipo “${corporativa.rotulo}” foi mantido.`,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/Nova ata iniciada/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova ata' })).toHaveFocus();

    // A IA volta a valer para a ata da pessoa.
    await preencherCorporativa(user);
    expect(botaoGerar()).toBeEnabled();
    expect(descricoes(botaoGerar())).not.toContain(MOTIVO_EXEMPLO);
    expect(gerar).not.toHaveBeenCalled();
  });

  it('"Começar a minha" devolve o tom da pessoa (o exemplo vem em tom formal), sem gravar preferências', async () => {
    simularLargura(true);
    const preferencias = criarPreferenciasStore(null, null);
    preferencias.definir({ tom: 'conciso' });
    const definir = vi.spyOn(preferencias, 'definir');
    const { user } = renderizar({ preferencias });
    const tom = () => screen.getByLabelText(/^Tom da redação/);
    expect(tom()).toHaveValue('conciso');

    await verExemplo(user, cipa.rotulo);
    expect(tom()).toHaveValue('formal');
    await user.click(within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }));
    expect(tom()).toHaveValue('conciso');
    expect(definir).not.toHaveBeenCalled();
  });

  it('trocar o tom dentro do exemplo vale só para o exemplo: não grava preferências e, ao sair, volta o da pessoa', async () => {
    simularLargura(true);
    const preferencias = criarPreferenciasStore(null, null);
    preferencias.definir({ tom: 'conciso' });
    const definir = vi.spyOn(preferencias, 'definir');
    const { user } = renderizar({ preferencias });
    const tom = () => screen.getByLabelText(/^Tom da redação/);
    await verExemplo(user, cipa.rotulo);

    await user.selectOptions(tom(), 'detalhado');
    expect(tom()).toHaveValue('detalhado');
    expect(definir).not.toHaveBeenCalled();
    expect(preferencias.atual().tom).toBe('conciso');

    await user.click(within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }));
    // O tom mudou: o exemplo não está mais intacto, então sair pergunta.
    const dialogo = screen.getByRole('dialog', { name: 'Fechar o exemplo?' });
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar e começar a minha' }));
    expect(tom()).toHaveValue('conciso');

    // Fora do exemplo, trocar o tom volta a gravar a escolha da pessoa.
    await user.selectOptions(tom(), 'formal');
    expect(definir).toHaveBeenCalledWith({ tom: 'formal' });
  });

  it('exemplo editado: "Começar a minha" pede confirmação; Cancelar mantém tudo; confirmar limpa', async () => {
    simularLargura(true);
    const { user } = renderizar();
    await verExemplo(user, cipa.rotulo);
    const empresa = () => screen.getByLabelText(/^Empresa/);
    await user.type(empresa(), ' Filial');

    const comecar = () => within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' });
    await user.click(comecar());
    let dialogo = screen.getByRole('dialog', { name: 'Fechar o exemplo?' });
    expect(dialogo).toHaveTextContent('As alterações que você fez no exemplo serão apagadas.');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(empresa()).toHaveValue('Metalúrgica Exemplo Ltda. Filial');
    expect(banner()).not.toBeNull();
    expect(comecar()).toHaveFocus();

    await user.click(comecar());
    dialogo = screen.getByRole('dialog', { name: 'Fechar o exemplo?' });
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar e começar a minha' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(banner()).toBeNull();
    expect(empresa()).toHaveValue('');
    expect(screen.getByText(/^Exemplo fechado\./)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nova ata' })).toHaveFocus();
  });

  it('"Nova ata" no modo exemplo: diz o que acontece (tom volta ao da pessoa), desliga o modo e apaga a marca', async () => {
    simularLargura(true);
    const preferencias = criarPreferenciasStore(null, null);
    preferencias.definir({ tom: 'conciso' });
    const { user } = renderizar({ preferencias });
    await verExemplo(user, cipa.rotulo);
    // Editado: agora há o que perder, então "Nova ata" pergunta.
    await user.type(screen.getByLabelText(/^Empresa/), ' Filial');

    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    const dialogo = screen.getByRole('dialog', { name: 'Começar uma nova ata?' });
    expect(dialogo).toHaveTextContent(
      'O exemplo desta aba (dados, participantes, transcrição e ata gerada) será apagado. O tipo de ata é mantido e o tom da redação volta ao que você usava.',
    );
    expect(dialogo).not.toHaveTextContent('O tipo de ata e o tom da redação são mantidos.');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar e começar' }));

    expect(banner()).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
    expect(
      screen.getByText('Nova ata iniciada. Tipo mantido; o tom voltou ao que você usava.'),
    ).toBeVisible();
    expect(screen.queryByText('Nova ata iniciada. Tipo e tom mantidos.')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Tom da redação/)).toHaveValue('conciso');
    expect(screen.queryByRole('img', { name: 'Logo da organização' })).not.toBeInTheDocument();
  });

  it('"Nova ata" com o exemplo intacto não pergunta (nada a perder): sai do exemplo e diz o que mudou', async () => {
    simularLargura(true);
    const preferencias = criarPreferenciasStore(null, null);
    preferencias.definir({ tom: 'conciso' });
    const { user } = renderizar({ preferencias });
    await verExemplo(user, cipa.rotulo);

    await user.click(screen.getByRole('button', { name: 'Nova ata' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(banner()).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
    expect(screen.getByLabelText(/^Empresa/)).toHaveValue('');
    expect(screen.getByLabelText(/^Tom da redação/)).toHaveValue('conciso');
    expect(
      screen.getByText('Nova ata iniciada. Tipo mantido; o tom voltou ao que você usava.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nova ata' })).toHaveFocus();
  });

  it('"Nova ata" no modo exemplo com logo da pessoa: o texto diz que a logo dela fica', async () => {
    simularLargura(true);
    const logoStore = criarLogoStore(null, null);
    logoStore.definir(LOGO_PESSOA);
    const { user } = renderizar({ logoStore });
    await verExemplo(user, cipa.rotulo);
    await user.type(screen.getByLabelText(/^Empresa/), ' Filial');

    await user.click(screen.getByRole('button', { name: 'Nova ata' }));
    const dialogo = screen.getByRole('dialog', { name: 'Começar uma nova ata?' });
    expect(dialogo).toHaveTextContent(
      'O exemplo desta aba (dados, participantes, transcrição e ata gerada) será apagado. O tipo de ata é mantido e o tom da redação volta ao que você usava. A sua logo é mantida.',
    );
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar e começar' }));
    expect(
      screen.getByText('Nova ata iniciada. Tipo e logo mantidos; o tom voltou ao que você usava.'),
    ).toBeVisible();
  });

  it('"Lembrar preferências" no exemplo não grava o tipo nem o tom do exemplo (ordem e modelos sim)', async () => {
    simularLargura(true);
    const local = storageFalso();
    const preferencias = criarPreferenciasStore(null, local.storage);
    preferencias.definir({ tipoId: 'corporativa', tom: 'conciso' });
    const definir = vi.spyOn(preferencias, 'definir');
    const { user } = renderizar({ preferencias, store: comChave() });
    const caixa = () =>
      screen.getByRole('checkbox', { name: 'Lembrar preferências neste navegador' });
    expect(caixa()).toHaveAccessibleDescription(AJUDA_LEMBRAR_PREFERENCIAS);
    await verExemplo(user, cipa.rotulo);
    // A ajuda diz a exceção do exemplo antes do clique.
    expect(caixa()).toHaveAccessibleDescription(
      `${AJUDA_LEMBRAR_PREFERENCIAS} ${AJUDA_LEMBRAR_NO_EXEMPLO}`,
    );

    await user.click(caixa());

    expect(definir).toHaveBeenCalledTimes(1);
    const gravado = definir.mock.calls[0]?.[0] ?? {};
    expect(gravado).not.toHaveProperty('tipoId');
    expect(gravado).not.toHaveProperty('tom');
    expect(gravado).toHaveProperty('ordem');
    expect(preferencias.lembrar()).toBe(true);
    const noNavegador: unknown = JSON.parse(local.itens.get(PREFERENCIAS) ?? '{}');
    expect(noNavegador).toMatchObject({ tipoId: 'corporativa', tom: 'conciso' });
  });
});

describe('modo exemplo: logo', () => {
  it('sem logo da pessoa a folha mostra a do exemplo; "Começar a minha" a tira', async () => {
    simularLargura(true);
    const { user, processar } = renderizar();
    await verExemplo(user, cipa.rotulo);

    const logo = await within(folha()).findByRole('img', { name: 'Logo da organização' });
    expect(logo).toHaveAttribute('src', LOGO_EXEMPLO.dataUrl);
    const arquivo = processar.mock.calls[0]?.[0];
    expect(arquivo?.name).toBe('logo-exemplo.svg');
    expect(arquivo?.type).toBe('image/svg+xml');

    await user.click(within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }));
    expect(
      within(folha()).queryByRole('img', { name: 'Logo da organização' }),
    ).not.toBeInTheDocument();
  });

  it('com logo da pessoa, a folha mostra a dela (a do exemplo nunca a substitui)', async () => {
    simularLargura(true);
    const logoStore = criarLogoStore(null, null);
    logoStore.definir(LOGO_PESSOA);
    const { user, processar } = renderizar({ logoStore });
    await verExemplo(user, cipa.rotulo);
    await waitFor(() => {
      expect(processar).toHaveBeenCalled();
    });

    expect(within(folha()).getByRole('img', { name: 'Logo da organização' })).toHaveAttribute(
      'src',
      LOGO_PESSOA.dataUrl,
    );
    await user.click(within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }));
    expect(within(folha()).getByRole('img', { name: 'Logo da organização' })).toHaveAttribute(
      'src',
      LOGO_PESSOA.dataUrl,
    );
  });

  it('falha ao rasterizar a logo do exemplo: segue sem logo, sem mensagem', async () => {
    simularLargura(true);
    const { user, processar } = renderizar();
    processar.mockImplementation(() => Promise.reject(new Error('canvas quebrado')));
    await verExemplo(user, cipa.rotulo);
    await waitFor(() => {
      expect(processar).toHaveBeenCalled();
    });

    expect(
      within(folha()).queryByRole('img', { name: 'Logo da organização' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/canvas/)).not.toBeInTheDocument();
    expect(banner()).not.toBeNull();
  });
});

describe('modo exemplo: recarregar a página', () => {
  it('remontar no exemplo: banner, IA parada e logo de volta, sem "Rascunho recuperado"; depois de "Começar a minha", nada volta', async () => {
    simularLargura(true);
    const primeira = renderizar({ store: comChave() });
    await verExemplo(primeira.user, cipa.rotulo);
    primeira.unmount();

    const segunda = renderizar({ store: comChave() });
    expect(banner()).toHaveTextContent(TEXTO_BANNER);
    expect(screen.queryByText(RECUPERADO)).not.toBeInTheDocument();
    expect(botaoGerar()).toBeDisabled();
    expect(descricoes(botaoGerar())).toEqual([MOTIVO_EXEMPLO]);
    expect(
      await within(folha()).findByRole('img', { name: 'Logo da organização' }),
    ).toHaveAttribute('src', LOGO_EXEMPLO.dataUrl);
    expect(segunda.processar).toHaveBeenCalledTimes(1);

    await segunda.user.click(
      within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }),
    );
    segunda.unmount();

    renderizar({ store: comChave() });
    expect(banner()).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
    expect(within(folha()).queryByText(/Metalúrgica Exemplo Ltda\./)).not.toBeInTheDocument();
  });

  it('marca de exemplo sem o rascunho correspondente é apagada e não liga o modo', () => {
    simularLargura(true);
    salvarRascunho(completo());
    gravarExemploNaSessao('cipa');
    renderizar();

    expect(banner()).toBeNull();
    expect(lerExemploDaSessao()).toBeNull();
    expect(screen.getByText(RECUPERADO)).toBeVisible();
  });
});

describe('modo exemplo: recarregar com o exemplo editado', () => {
  it('editado antes do F5: "Começar a minha" pergunta e "Ver exemplo" avisa a substituição', async () => {
    simularLargura(true);
    const primeira = renderizar();
    await verExemplo(primeira.user, cipa.rotulo);
    await primeira.user.click(screen.getByLabelText(/^Transcrição da reunião/));
    await primeira.user.keyboard('{Control>}a{/Control}');
    await primeira.user.paste('Ana: a transcrição da minha reunião.');
    primeira.unmount();

    const segunda = renderizar();
    await waitFor(() => {
      expect(segunda.processar).toHaveBeenCalled();
    });
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue(
      'Ana: a transcrição da minha reunião.',
    );

    const dialogo = await abrirSeletor(segunda.user);
    expect(dialogo).toHaveTextContent(AVISO_SUBSTITUIR);
    await segunda.user.keyboard('{Escape}');

    await segunda.user.click(
      within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }),
    );
    expect(screen.getByRole('dialog', { name: 'Fechar o exemplo?' })).toBeVisible();
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue(
      'Ana: a transcrição da minha reunião.',
    );
  });

  it('intacto antes do F5: "Começar a minha" não pergunta e "Ver exemplo" não avisa', async () => {
    simularLargura(true);
    const primeira = renderizar();
    await verExemplo(primeira.user, cipa.rotulo);
    primeira.unmount();

    const segunda = renderizar();
    await waitFor(() => {
      expect(segunda.processar).toHaveBeenCalled();
    });
    const dialogo = await abrirSeletor(segunda.user);
    expect(dialogo).not.toHaveTextContent(AVISO_SUBSTITUIR);
    await segunda.user.keyboard('{Escape}');

    await segunda.user.click(
      within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(banner()).toBeNull();
  });

  it('o exemplo não carrega no F5: na dúvida, "Começar a minha" pergunta', async () => {
    simularLargura(true);
    const primeira = renderizar();
    await verExemplo(primeira.user, cipa.rotulo);
    primeira.unmount();

    const segunda = renderizar({
      exemplos: { ...exemplosReais, cipa: () => Promise.reject(new Error('sem rede')) },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(banner()).not.toBeNull();
    await segunda.user.click(
      within(bannerAtivo()).getByRole('button', { name: 'Começar a minha' }),
    );
    expect(screen.getByRole('dialog', { name: 'Fechar o exemplo?' })).toBeVisible();
    expect(segunda.processar).not.toHaveBeenCalled();
  });
});

describe('modo exemplo: corridas', () => {
  it('regeração de seção em andamento: entrar no exemplo a aborta e o resultado tardio nunca cai nele', async () => {
    simularLargura(true);
    salvarRascunho({
      ...completo(),
      resultado: {
        secoes: Object.fromEntries(
          corporativa.secoes.map((sec) => [
            sec.chave,
            [{ tipo: 'paragrafo' as const, texto: `Texto de ${sec.chave}.`, itens: [] }],
          ]),
        ),
        encaminhamentos: [],
        atribuicao: {},
        avisos: {},
        editadas: [],
      },
    });
    let sinal: AbortSignal | null = null;
    let entregar: (v: unknown) => void = () => undefined;
    const { user } = renderizar({
      store: comChave(),
      gerar: (_cfg, req) => {
        sinal = req.signal;
        return new Promise((resolve) => {
          entregar = resolve;
        });
      },
    });

    await user.click(screen.getByRole('button', { name: 'Regerar seção Resumo' }));
    expect(screen.getByRole('progressbar', { name: 'Regerando a seção Resumo' })).toBeVisible();

    const dialogo = await abrirSeletor(user);
    expect(dialogo).toHaveTextContent(AVISO_CANCELAR);
    await user.click(within(dialogo).getByRole('button', { name: cipa.rotulo }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect((sinal as AbortSignal | null)?.aborted).toBe(true);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await act(async () => {
      entregar({ blocos: [{ tipo: 'paragrafo', texto: 'Seção tardia.', itens: [] }] });
      await Promise.resolve();
    });
    expect(within(folha()).queryByText('Seção tardia.')).not.toBeInTheDocument();
    expect(screen.queryByText(/regerada por/)).not.toBeInTheDocument();
    expect(within(folha()).getAllByText(/Metalúrgica Exemplo Ltda\./).length).toBeGreaterThan(0);
  });

  it('duas escolhas seguidas: a primeira, mais lenta, chega por último e não vale', async () => {
    simularLargura(true);
    let entregarCipa: (ex: Exemplo) => void = () => undefined;
    const { user } = renderizar({
      exemplos: {
        ...exemplosReais,
        cipa: () =>
          new Promise<Exemplo>((resolve) => {
            entregarCipa = resolve;
          }),
      },
    });

    let dialogo = await abrirSeletor(user);
    await user.click(within(dialogo).getByRole('button', { name: cipa.rotulo }));
    await user.keyboard('{Escape}');
    dialogo = await abrirSeletor(user);
    // A escolha anterior foi descartada: nada fica ocupado nem parado.
    expect(within(dialogo).getByRole('button', { name: cipa.rotulo })).not.toHaveAttribute(
      'aria-busy',
    );
    await user.click(within(dialogo).getByRole('button', { name: corporativa.rotulo }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await act(async () => {
      entregarCipa(exemploCipa);
      await Promise.resolve();
    });
    expect(bannerAtivo()).toHaveTextContent(`Exemplo: ${corporativa.rotulo}.`);
    expect(within(folha()).queryByText(/Metalúrgica Exemplo Ltda\./)).not.toBeInTheDocument();
    expect(lerExemploDaSessao()).toBe('corporativa');
    expect(screen.queryByText(new RegExp(`Exemplo carregado: ${cipa.rotulo}`))).toBeNull();
  });
});
