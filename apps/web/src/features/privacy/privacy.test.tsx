import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mask } from '@lavra/pii-br';
import { corporativa } from '../../ata-types/corporativa';
import { DEBOUNCE_DETECCAO_MS, LIMITE_TRANSCRICAO } from '../../config/limits';
import { DraftProvider } from '../../domain/DraftContext';
import { TranscricaoBlock } from '../form/TranscricaoBlock';
import { ToastProvider } from '../../ui/Toast';

// `mask` real, mas espionado: o teste de volume prova que ele só roda depois do debounce.
vi.mock('@lavra/pii-br', async (original) => {
  const real = await original<typeof import('@lavra/pii-br')>();
  return { ...real, mask: vi.fn(real.mask) };
});

const CPF_A = '529.982.247-25';
const CPF_B = '111.444.777-35';
const TELEFONE = '(11) 98888-7777';
const TEXTO = `Maria informou o CPF ${CPF_A}. João informou o CPF ${CPF_B}. Contato: ${TELEFONE}.`;

function renderizar() {
  return render(
    <ToastProvider>
      <DraftProvider>
        <TranscricaoBlock tipo={corporativa} />
      </DraftProvider>
    </ToastProvider>,
  );
}

function colar(texto: string) {
  fireEvent.change(screen.getByLabelText(/^Transcrição da reunião/), { target: { value: texto } });
}

function passarDebounce() {
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_DETECCAO_MS);
  });
}

function arquivo(conteudo: string, nome: string, tipo = 'text/plain'): File {
  return new File([conteudo], nome, { type: tipo });
}

function campoArquivo(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input[type="file"]');
  if (!(el instanceof HTMLInputElement)) throw new Error('input de arquivo não encontrado');
  return el;
}

describe('prévia de privacidade', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra o selo com a contagem só depois do debounce', () => {
    renderizar();
    colar(TEXTO);
    expect(screen.queryByText(/dados pessoais serão protegidos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Verificando dados pessoais/)).toBeInTheDocument();
    passarDebounce();
    expect(
      screen.getByText('3 dados pessoais serão protegidos (2 CPF, 1 telefone)'),
    ).toBeInTheDocument();
  });

  it('pluraliza: 1 dado, telefones e e-mails', () => {
    renderizar();
    colar(`CPF ${CPF_A}`);
    passarDebounce();
    expect(screen.getByText('1 dado pessoal será protegido (1 CPF)')).toBeInTheDocument();

    colar(
      'Ligue (11) 98888-7777 ou (21) 97777-6666. Escreva a ana@exemplo.com ou bia@exemplo.com.',
    );
    passarDebounce();
    expect(
      screen.getByText('4 dados pessoais serão protegidos (2 e-mails, 2 telefones)'),
    ).toBeInTheDocument();
  });

  it('sem dados estruturados, avisa que nenhum foi encontrado', () => {
    renderizar();
    colar('Reunião sem nenhum dado sensível.');
    passarDebounce();
    expect(screen.getByText('Nenhum dado pessoal estruturado encontrado')).toBeInTheDocument();
  });

  it('o modal mostra [CPF_1] destacado e o CPF não aparece em "Enviado à IA"', async () => {
    renderizar();
    colar(TEXTO);
    passarDebounce();
    // O asyncWrapper do Testing Library trava com timers falsos do Vitest: o resto usa os reais.
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ver o que vai para a IA' }));

    const dialogo = screen.getByRole('dialog');
    const enviado = within(dialogo).getByRole('region', { name: 'Enviado à IA' });
    expect(within(enviado).getByText('[CPF_1]').tagName).toBe('MARK');
    expect(within(enviado).getByText('[CPF_2]').tagName).toBe('MARK');
    expect(within(enviado).getByText('[TELEFONE_1]').tagName).toBe('MARK');
    expect(enviado.textContent).not.toContain(CPF_A);
    expect(enviado.textContent).not.toContain(TELEFONE);

    const original = within(dialogo).getByRole('region', { name: 'Original' });
    expect(original.textContent).toContain(CPF_A);
    expect(
      within(dialogo).getByText('Nomes de pessoas não são removidos — a ata precisa deles.'),
    ).toBeInTheDocument();
  });

  it('termo sensível: uma linha a mais no selo, com ícone, categorias e plural', () => {
    renderizar();
    colar(`Joana está afastada por depressão. Ela entrou com processo trabalhista. CPF ${CPF_A}`);
    expect(screen.queryByText(/possível dado sensível/)).not.toBeInTheDocument();
    passarDebounce();
    const linha = screen.getByText(
      '3 trechos com possível dado sensível (saúde, conflito trabalhista) vão como estão — revise antes de enviar.',
    );
    expect(linha.closest('p')).toHaveTextContent(/^⚠/);
    expect(linha.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByText('1 dado pessoal será protegido (1 CPF)')).toBeInTheDocument();

    colar('Faltou o atestado.');
    passarDebounce();
    expect(
      screen.getByText(
        '1 trecho com possível dado sensível (saúde) vai como está — revise antes de enviar.',
      ),
    ).toBeInTheDocument();

    colar('Reunião sem nada disso.');
    passarDebounce();
    expect(screen.queryByText(/possível dado sensível/)).not.toBeInTheDocument();
  });

  it('o comparativo destaca o termo sensível nas duas colunas; o dado pessoal vence a sobreposição', async () => {
    renderizar();
    colar(`Joana está afastada por depressão, CPF ${CPF_A}.`);
    passarDebounce();
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ver o que vai para a IA' }));
    const dialogo = screen.getByRole('dialog');
    for (const nome of ['Original', 'Enviado à IA']) {
      const coluna = within(dialogo).getByRole('region', { name: nome });
      const afastada = within(coluna).getByText('afastada');
      expect(afastada.tagName).toBe('MARK');
      expect(within(coluna).getByText('depressão').tagName).toBe('MARK');
      // Estilo próprio, diferente do marcador e do valor original.
      expect(afastada.className).not.toBe(
        within(coluna).getByText(nome === 'Original' ? CPF_A : '[CPF_1]').className,
      );
    }
    expect(
      within(dialogo).getByText(/Trechos com contorno tracejado são possível dado sensível/),
    ).toBeInTheDocument();
  });

  it('acima do limite não analisa: avisa o motivo e desabilita a prévia', () => {
    renderizar();
    colar('x'.repeat(LIMITE_TRANSCRICAO + 1));
    passarDebounce();
    expect(
      screen.getByText('Reduza a transcrição ao limite para ver a prévia.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dados pessoais serão protegidos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verificando/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver o que vai para a IA' })).toBeDisabled();
    // Voltando ao limite, a análise volta.
    colar(`CPF ${CPF_A}`);
    passarDebounce();
    expect(screen.getByText('1 dado pessoal será protegido (1 CPF)')).toBeInTheDocument();
  });

  it('o botão do modal fica desabilitado sem transcrição', () => {
    renderizar();
    expect(screen.getByRole('button', { name: 'Ver o que vai para a IA' })).toBeDisabled();
  });

  it('200 mil caracteres: digitar não roda a detecção; ela roda uma vez só após o debounce', () => {
    renderizar();
    const base = `Maria informou o CPF ${CPF_A} na pauta. `;
    const grande = base.repeat(Math.ceil(200_000 / base.length)).slice(0, 200_000);
    expect(grande).toHaveLength(200_000);

    colar('a');
    passarDebounce();
    const espiao = vi.mocked(mask);
    espiao.mockClear();

    const t0 = performance.now();
    colar(grande);
    const ms = performance.now() - t0;

    // O custo da digitação não inclui o `mask`: nenhuma chamada antes do debounce.
    expect(espiao).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue(grande);
    expect(screen.queryByText(/dados pessoais serão protegidos/)).not.toBeInTheDocument();
    // Só uma rede contra regressão grosseira (o tempo real é medido no E2E, em navegador).
    expect(ms).toBeLessThan(2000);

    passarDebounce();
    expect(espiao).toHaveBeenCalled();
    expect(espiao.mock.calls.every(([texto]) => texto === grande)).toBe(true);
    expect(screen.getByText(/dados pessoais serão protegidos \(\d+ CPF\)/)).toBeInTheDocument();
  });

  it('várias digitações dentro do intervalo disparam uma detecção só ao final', () => {
    renderizar();
    colar('a');
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_DETECCAO_MS - 50);
    });
    colar(`CPF ${CPF_A}`);
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_DETECCAO_MS - 50);
    });
    expect(screen.queryByText(/dados pessoais serão protegidos/)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText('1 dado pessoal será protegido (1 CPF)')).toBeInTheDocument();
  });
});

describe('contador de caracteres', () => {
  it('verde abaixo de 90%', () => {
    renderizar();
    colar('x'.repeat(1000));
    const contador = screen.getByTestId('contador-transcricao');
    expect(contador).toHaveAttribute('data-nivel', 'ok');
    expect(contador).toHaveTextContent('1.000 de 300.000 caracteres');
  });

  it('amarelo a partir de 90%, com texto além da cor', () => {
    renderizar();
    colar('x'.repeat(LIMITE_TRANSCRICAO * 0.9));
    const contador = screen.getByTestId('contador-transcricao');
    expect(contador).toHaveAttribute('data-nivel', 'atencao');
    expect(contador).toHaveTextContent('Perto do limite');
  });

  it('o limite exato ainda é aceito', () => {
    renderizar();
    colar('x'.repeat(LIMITE_TRANSCRICAO));
    expect(screen.getByTestId('contador-transcricao')).toHaveAttribute('data-nivel', 'atencao');
    expect(screen.queryByText(/passou do limite/)).not.toBeInTheDocument();
  });

  it('vermelho acima do limite, com a mensagem exata', () => {
    renderizar();
    colar('x'.repeat(LIMITE_TRANSCRICAO + 1));
    const contador = screen.getByTestId('contador-transcricao');
    expect(contador).toHaveAttribute('data-nivel', 'excedido');
    expect(
      screen.getByText(
        'A transcrição passou do limite de 300 mil caracteres. Divida a reunião ou remova trechos sem conteúdo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});

describe('arquivo de transcrição', () => {
  it('lê um .txt para o campo', async () => {
    const { container } = renderizar();
    const user = userEvent.setup();
    await user.upload(campoArquivo(container), arquivo('Maria: olá.\nJoão: oi.', 'reuniao.txt'));
    expect(await screen.findByDisplayValue(/Maria: olá/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('reuniao.txt');
  });

  it('converte .vtt em "Nome: fala" sem timestamps', async () => {
    const { container } = renderizar();
    const user = userEvent.setup();
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Maria Souza>Bom dia.</v>\n';
    await user.upload(campoArquivo(container), arquivo(vtt, 'reuniao.vtt', 'text/vtt'));
    expect(await screen.findByDisplayValue('Maria Souza: Bom dia.')).toBeInTheDocument();
  });

  it('outra extensão: erro com causa e ação, sem alterar o texto', async () => {
    const { container } = renderizar();
    const user = userEvent.setup({ applyAccept: false });
    colar('texto original');
    await user.upload(campoArquivo(container), arquivo('%PDF', 'ata.pdf', 'application/pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo “ata.pdf” não é .txt nem .vtt. Salve a transcrição em um desses formatos e envie de novo.',
    );
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue('texto original');
  });

  it('acima de 5 MB: erro claro', async () => {
    const { container } = renderizar();
    const user = userEvent.setup();
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'enorme.txt', {
      type: 'text/plain',
    });
    await user.upload(campoArquivo(container), grande);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo “enorme.txt” passa de 5 MB. Divida a transcrição em partes menores e envie de novo.',
    );
  });

  it('falha ao ler o arquivo: erro tratado', async () => {
    const { container } = renderizar();
    const user = userEvent.setup();
    const quebrado = arquivo('x', 'quebrado.txt');
    Object.defineProperty(quebrado, 'text', {
      value: () => Promise.reject(new Error('falha de leitura')),
    });
    await user.upload(campoArquivo(container), quebrado);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível ler “quebrado.txt”. Tente enviar o arquivo de novo ou cole o texto no campo.',
    );
  });

  it('arquivo fora do UTF-8 avisa e não esconde o problema', async () => {
    const { container } = renderizar();
    const user = userEvent.setup();
    await user.upload(campoArquivo(container), arquivo('reuni�o', 'velho.txt'));
    expect(await screen.findByRole('status')).toHaveTextContent('UTF-8');
  });

  it('Desfazer devolve o texto anterior depois de enviar um arquivo por cima', async () => {
    const { container } = renderizar();
    const user = userEvent.setup();
    colar('texto antigo');
    await user.upload(campoArquivo(container), arquivo('texto novo do arquivo', 'novo.txt'));
    expect(await screen.findByDisplayValue('texto novo do arquivo')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('O texto anterior foi substituído.');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue('texto antigo');
  });

  it('Limpar apaga e oferece Desfazer', async () => {
    renderizar();
    const user = userEvent.setup();
    colar('texto importante');
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByLabelText(/^Transcrição da reunião/)).toHaveValue('texto importante');
  });

  it('Limpar fica desabilitado com o campo vazio', () => {
    renderizar();
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled();
  });
});
