import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obterTipo } from '../../ata-types/registry';
import { construirDocumento } from '../../document/build-model';
import type { DocumentModel } from '../../document/model';
import type { AtaDraft, Encaminhamento, ResultadoAta } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { baixarArquivo } from '../../export/baixar';
import type { CarregadoresExportacao } from '../../export/exportar';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { renderizarComProvedores } from '../../test/provedores';
import { ExportBar } from './ExportBar';

vi.mock('../../export/baixar', () => ({ baixarArquivo: vi.fn() }));
const baixarMock = vi.mocked(baixarArquivo);

const DADOS = {
  organizacao: 'Cooperativa Fictícia',
  assunto: 'Reembolsos',
  data: '2026-10-14',
  inicio: '14:30',
  modalidade: 'remota',
  local: 'Videoconferência',
  conducao: 'Ana Souza',
};

const ENCAMINHAMENTOS: Encaminhamento[] = [
  { acao: 'Enviar a planilha', responsavel: 'Ana Souza', prazo: '2026-10-30', status: 'pendente' },
  { acao: 'Rever o contrato', responsavel: 'Bruno Lima', prazo: '', status: 'pendente' },
];

function resultado(encaminhamentos: Encaminhamento[] = ENCAMINHAMENTOS): ResultadoAta {
  return {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: 'Foi tratado o reembolso.', itens: [] }],
      discussao: [],
      decisoes: [],
      pendencias: [],
      riscos: [],
      proxima_reuniao: [],
    },
    encaminhamentos,
    atribuicao: {},
    avisos: {},
    editadas: [],
  };
}

function rascunho(comResultado: ResultadoAta | null = resultado()): AtaDraft {
  return { ...criarRascunho(), dados: DADOS, resultado: comResultado };
}

function modeloDe(d: AtaDraft, titulo?: string): DocumentModel {
  const modelo = construirDocumento(d, obterTipo(d.tipoId), null);
  return titulo === undefined ? modelo : { ...modelo, titulo };
}

function carregadoresFalsos(sobrescrever: Partial<CarregadoresExportacao> = {}) {
  const carregadores: CarregadoresExportacao = {
    pdf: () => Promise.resolve({ gerarPdf: () => Promise.resolve(new Blob(['pdf'])) }),
    docx: () => Promise.resolve({ gerarDocx: () => Promise.resolve(new Blob(['docx'])) }),
    ...sobrescrever,
  };
  return carregadores;
}

/** Liga uma operação de IA para provar os estados desabilitados. */
function ControleIA() {
  const { iniciar } = useOperacaoIA();
  return (
    <button
      type="button"
      onClick={() => {
        iniciar({ tipo: 'ata' });
      }}
    >
      simular IA
    </button>
  );
}

interface Opcoes {
  inicial?: AtaDraft;
  modelo?: DocumentModel;
  lacunas?: number;
  editoresAbertos?: number;
  onIrParaLacuna?: () => void;
  carregadores?: CarregadoresExportacao;
}

function renderizar(opcoes: Opcoes = {}) {
  const inicial = opcoes.inicial ?? rascunho();
  return renderizarComProvedores(
    <>
      <ControleIA />
      <ExportBar
        modelo={opcoes.modelo ?? modeloDe(inicial)}
        lacunas={opcoes.lacunas ?? 0}
        onIrParaLacuna={opcoes.onIrParaLacuna ?? (() => undefined)}
        carregadores={opcoes.carregadores ?? carregadoresFalsos()}
        {...(opcoes.editoresAbertos === undefined
          ? {}
          : { editoresAbertos: opcoes.editoresAbertos })}
      />
    </>,
    { inicial },
  );
}

const botaoPdf = () => screen.getByRole('button', { name: /^(Baixar|Gerando) PDF/ });
const botaoDocx = () => screen.getByRole('button', { name: /^(Baixar|Gerando) DOCX/ });
const botaoCopiar = () => screen.getByRole('button', { name: 'Copiar tarefas por responsável' });

/** Textos que descrevem o botão (`aria-describedby`). */
function descricaoDe(botao: HTMLElement): string[] {
  return (botao.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

beforeEach(() => {
  baixarMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportBar: estados desabilitados', () => {
  it('sem ata gerada: os downloads ficam desabilitados com o motivo visível e ligado', () => {
    renderizar({ inicial: rascunho(null) });
    expect(screen.getByText('Gere a ata para baixar o PDF ou o DOCX.')).toBeVisible();
    for (const botao of [botaoPdf(), botaoDocx()]) {
      expect(botao).toBeDisabled();
      expect(descricaoDe(botao)).toContain('Gere a ata para baixar o PDF ou o DOCX.');
    }
  });

  it('com operação de IA em andamento: os três ficam desabilitados com o motivo da IA', async () => {
    const usuario = userEvent.setup();
    renderizar();
    expect(botaoPdf()).toBeEnabled();
    await usuario.click(screen.getByRole('button', { name: 'simular IA' }));
    for (const botao of [botaoPdf(), botaoDocx(), botaoCopiar()]) {
      expect(botao).toBeDisabled();
      expect(descricaoDe(botao)).toContain(MOTIVO_IA_OCUPADA);
    }
  });

  it('sem encaminhamentos: copiar fica desabilitado com o motivo e os downloads seguem livres', () => {
    renderizar({ inicial: rascunho(resultado([])) });
    expect(botaoCopiar()).toBeDisabled();
    expect(descricaoDe(botaoCopiar())).toContain('A ata não tem encaminhamentos para copiar.');
    expect(botaoPdf()).toBeEnabled();
    expect(botaoDocx()).toBeEnabled();
  });
});

describe('ExportBar: baixar', () => {
  it('sem lacunas: "Baixar PDF" baixa com o nome do arquivo e avisa "PDF baixado"', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(botaoPdf());
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledTimes(1);
    });
    expect(baixarMock).toHaveBeenCalledWith(expect.any(Blob), 'ata-corporativa-2026-10-14.pdf');
    expect(await screen.findByText('PDF baixado')).toBeInTheDocument();
    expect(screen.getByText('ata-corporativa-2026-10-14.pdf')).toBeInTheDocument();
  });

  it('"Baixar DOCX" baixa o .docx e avisa "DOCX baixado"', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(botaoDocx());
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledWith(expect.any(Blob), 'ata-corporativa-2026-10-14.docx');
    });
    expect(await screen.findByText('DOCX baixado')).toBeInTheDocument();
  });

  it('gera o arquivo a partir do modelo recebido', async () => {
    const usuario = userEvent.setup();
    const inicial = rascunho();
    const modelo = modeloDe(inicial, 'Ata do dia');
    const gerarPdf = vi.fn<(modelo: DocumentModel) => Promise<Blob>>(() =>
      Promise.resolve(new Blob(['pdf'])),
    );
    renderizar({
      inicial,
      modelo,
      carregadores: carregadoresFalsos({ pdf: () => Promise.resolve({ gerarPdf }) }),
    });
    await usuario.click(botaoPdf());
    await waitFor(() => {
      expect(gerarPdf).toHaveBeenCalledTimes(1);
    });
    expect(gerarPdf).toHaveBeenCalledWith(modelo);
  });
});

describe('ExportBar: confirmação antes de baixar', () => {
  it('com 2 lacunas: abre o modal, e "Baixar mesmo assim" baixa', async () => {
    const usuario = userEvent.setup();
    renderizar({ lacunas: 2 });
    await usuario.click(botaoPdf());
    const modal = await screen.findByRole('dialog', {
      name: 'A ata ainda tem campos para preencher',
    });
    expect(
      within(modal).getByText(
        '2 campos marcados com [PREENCHER] vão sair no documento como estão.',
      ),
    ).toBeInTheDocument();
    expect(baixarMock).not.toHaveBeenCalled();
    await usuario.click(within(modal).getByRole('button', { name: 'Baixar mesmo assim' }));
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledWith(expect.any(Blob), 'ata-corporativa-2026-10-14.pdf');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('1 lacuna usa o singular', async () => {
    const usuario = userEvent.setup();
    renderizar({ lacunas: 1 });
    await usuario.click(botaoDocx());
    expect(
      await screen.findByText('1 campo marcado com [PREENCHER] vai sair no documento como está.'),
    ).toBeInTheDocument();
  });

  it('"Ir até o primeiro" fecha o modal, chama onIrParaLacuna DEPOIS de fechar e não baixa', async () => {
    const usuario = userEvent.setup();
    let modalAbertoNaChamada: boolean | null = null;
    let focoNaChamada: Element | null = null;
    const onIr = vi.fn(() => {
      modalAbertoNaChamada = screen.queryByRole('dialog') !== null;
      focoNaChamada = document.activeElement;
    });
    renderizar({ lacunas: 2, onIrParaLacuna: onIr });
    await usuario.click(botaoPdf());
    await usuario.click(await screen.findByRole('button', { name: 'Ir até o primeiro' }));
    expect(onIr).toHaveBeenCalledTimes(1);
    expect(modalAbertoNaChamada).toBe(false);
    // O Modal já devolveu o foco ao botão de origem quando o foco da lacuna entra em cena: o foco
    // da lacuna (chamado por onIrParaLacuna) é o último e fica.
    expect(focoNaChamada).toBe(botaoPdf());
    expect(baixarMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fechar o modal sem confirmar não baixa nem chama onIrParaLacuna', async () => {
    const usuario = userEvent.setup();
    const onIr = vi.fn();
    renderizar({ lacunas: 3, onIrParaLacuna: onIr });
    await usuario.click(botaoPdf());
    await usuario.click(await screen.findByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(baixarMock).not.toHaveBeenCalled();
    expect(onIr).not.toHaveBeenCalled();
  });

  it('modelo com "Ж": o modal do PDF lista o caractere; o DOCX baixa direto', async () => {
    const usuario = userEvent.setup();
    const inicial = rascunho();
    renderizar({ inicial, modelo: modeloDe(inicial, 'Ata Ж') });
    await usuario.click(botaoDocx());
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await usuario.click(botaoPdf());
    const modal = await screen.findByRole('dialog', { name: 'Alguns caracteres não cabem no PDF' });
    expect(
      within(modal).getByText(
        'Estes caracteres não existem na fonte do PDF e vão aparecer como um quadrado: Ж. O DOCX mostra todos.',
      ),
    ).toBeInTheDocument();
    expect(within(modal).queryByRole('button', { name: 'Ir até o primeiro' })).toBeNull();
    expect(baixarMock).toHaveBeenCalledTimes(1);
  });

  it('lacunas e caractere sem fonte juntos: o modal do PDF mostra os dois parágrafos', async () => {
    const usuario = userEvent.setup();
    const inicial = rascunho();
    renderizar({ inicial, modelo: modeloDe(inicial, 'Ata Ж'), lacunas: 2 });
    await usuario.click(botaoPdf());
    const modal = await screen.findByRole('dialog', {
      name: 'A ata ainda tem campos para preencher',
    });
    expect(within(modal).getByText(/2 campos marcados com \[PREENCHER\]/)).toBeInTheDocument();
    expect(within(modal).getByText(/não existem na fonte do PDF.*: Ж\./)).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Ir até o primeiro' })).toBeInTheDocument();
  });

  it('no DOCX, caractere sem fonte do PDF não abre modal; só as lacunas', async () => {
    const usuario = userEvent.setup();
    const inicial = rascunho();
    renderizar({ inicial, modelo: modeloDe(inicial, 'Ata Ж'), lacunas: 1 });
    await usuario.click(botaoDocx());
    const modal = await screen.findByRole('dialog');
    expect(within(modal).queryByText(/fonte do PDF/)).toBeNull();
  });

  it('com editor de seção aberto: o modal avisa que o texto não salvo não entra no arquivo', async () => {
    const usuario = userEvent.setup();
    renderizar({ editoresAbertos: 1 });
    await usuario.click(botaoPdf());
    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText(
        'Há 1 editor de seção aberto. O texto que ainda não foi salvo nele não entra no arquivo.',
      ),
    ).toBeInTheDocument();
    expect(baixarMock).not.toHaveBeenCalled();
    await usuario.click(within(modal).getByRole('button', { name: 'Baixar mesmo assim' }));
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ExportBar: exportando', () => {
  it('mostra "Gerando PDF…", desabilita o DOCX e ignora o segundo clique', async () => {
    const usuario = userEvent.setup();
    let liberar: (b: Blob) => void = () => undefined;
    const pendente = new Promise<Blob>((resolve) => {
      liberar = resolve;
    });
    const carregarPdf = vi.fn(() => Promise.resolve({ gerarPdf: () => pendente }));
    renderizar({ carregadores: carregadoresFalsos({ pdf: carregarPdf }) });

    await usuario.click(botaoPdf());
    const ocupado = screen.getByRole('button', { name: 'Gerando PDF…' });
    expect(ocupado).toHaveAttribute('aria-busy', 'true');
    expect(botaoDocx()).toBeDisabled();
    await usuario.click(ocupado);
    await usuario.click(ocupado);
    expect(carregarPdf).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberar(new Blob(['pdf']));
      await pendente;
    });
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeEnabled();
    expect(botaoDocx()).toBeEnabled();
  });

  it('falha de carregamento mostra a mensagem fixa em role=alert, sem o texto do erro', async () => {
    const usuario = userEvent.setup();
    renderizar({
      carregadores: carregadoresFalsos({
        pdf: () => Promise.reject(new Error('ChunkLoadError segredo 529.982.247-25')),
      }),
    });
    await usuario.click(botaoPdf());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'Não foi possível carregar o gerador de PDF. Verifique a conexão e recarregue a página — o rascunho desta aba fica salvo.',
    );
    expect(alerta).not.toHaveTextContent('ChunkLoadError');
    expect(alerta).not.toHaveTextContent('529.982.247-25');
    expect(baixarMock).not.toHaveBeenCalled();
    expect(screen.queryByText('PDF baixado')).toBeNull();
  });

  it('falha de geração mostra a mensagem fixa, sem o texto do erro nem console, e some na próxima tentativa', async () => {
    const usuario = userEvent.setup();
    let falhar = true;
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderizar({
      carregadores: carregadoresFalsos({
        docx: () =>
          Promise.resolve({
            gerarDocx: () =>
              falhar
                ? Promise.reject(new Error('segredo 529.982.247-25'))
                : Promise.resolve(new Blob(['docx'])),
          }),
      }),
    });
    await usuario.click(botaoDocx());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'Não foi possível gerar o DOCX. Tente de novo; se persistir, baixe o PDF.',
    );
    expect(alerta).not.toHaveTextContent('529.982.247-25');
    expect(consoleErro).not.toHaveBeenCalled();

    falhar = false;
    await usuario.click(botaoDocx());
    await waitFor(() => {
      expect(baixarMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('desmontar antes de terminar descarta o arquivo: sem download e sem aviso', async () => {
    const usuario = userEvent.setup();
    let liberar: (b: Blob) => void = () => undefined;
    const pendente = new Promise<Blob>((resolve) => {
      liberar = resolve;
    });
    const { unmount } = renderizar({
      carregadores: carregadoresFalsos({
        pdf: () => Promise.resolve({ gerarPdf: () => pendente }),
      }),
    });
    await usuario.click(botaoPdf());
    unmount();
    await act(async () => {
      liberar(new Blob(['pdf']));
      await pendente;
    });
    expect(baixarMock).not.toHaveBeenCalled();
    expect(screen.queryByText('PDF baixado')).toBeNull();
  });
});

describe('ExportBar: copiar tarefas', () => {
  function simularClipboard(writeText: (t: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copia o texto das tarefas e avisa quantas pessoas', async () => {
    const usuario = userEvent.setup({ writeToClipboard: false });
    const writeText = vi.fn<(texto: string) => Promise<void>>(() => Promise.resolve());
    simularClipboard(writeText);
    renderizar();
    await usuario.click(botaoCopiar());
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const texto = writeText.mock.calls[0]?.[0] ?? '';
    expect(texto).toContain('Tarefas por responsável');
    expect(texto).toContain('Ana Souza');
    expect(await screen.findByText('Tarefas de 2 pessoas copiadas.')).toBeInTheDocument();
  });

  it('writeText que rejeita abre a cópia manual com a textarea selecionada', async () => {
    const usuario = userEvent.setup({ writeToClipboard: false });
    simularClipboard(() => Promise.reject(new Error('NotAllowedError dados da ata')));
    renderizar();
    await usuario.click(botaoCopiar());
    const modal = await screen.findByRole('dialog', { name: 'Copie as tarefas' });
    const campo = within(modal).getByLabelText('Tarefas por responsável');
    expect(campo).toBeInstanceOf(HTMLTextAreaElement);
    const textarea = campo as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toContain('Tarefas por responsável');
    expect(textarea.value).toContain('Ana Souza');
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
    expect(document.activeElement).toBe(textarea);
    expect(
      within(modal).getByText(
        'Não foi possível copiar automaticamente. O texto já está selecionado: use Ctrl+C (ou Copiar, no celular).',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/NotAllowedError/)).toBeNull();

    const fechar = within(modal).getAllByRole('button', { name: 'Fechar' });
    const rodape = fechar.at(-1);
    if (rodape === undefined) throw new Error('sem botão Fechar');
    await usuario.click(rodape);
    expect(screen.queryByRole('dialog')).toBeNull();
    // O foco volta ao botão que abriu a cópia manual.
    expect(document.activeElement).toBe(botaoCopiar());
  });

  it('sem a API da área de transferência cai direto na cópia manual', async () => {
    const usuario = userEvent.setup({ writeToClipboard: false });
    renderizar();
    Reflect.deleteProperty(navigator, 'clipboard');
    await usuario.click(botaoCopiar());
    expect(await screen.findByRole('dialog', { name: 'Copie as tarefas' })).toBeInTheDocument();
  });
});
