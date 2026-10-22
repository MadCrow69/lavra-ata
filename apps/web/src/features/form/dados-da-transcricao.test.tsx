import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import { LIMITE_PARTICIPANTES } from '../../config/limits';
import type { AtaDraft, Participante } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { renderizarComProvedores } from '../../test/provedores';
import { FALANTES_FICTICIOS, vttFicticio } from '../../test/vtt-ficticio';
import { DadosBlock } from './DadosBlock';
import { ParticipantesBlock } from './ParticipantesBlock';
import { TranscricaoBlock } from './TranscricaoBlock';

function participante(i: number, nome: string): Participante {
  return {
    id: `p${String(i)}`,
    nome,
    papel: '',
    presenca: 'presente',
    justificativa: '',
    extras: {},
  };
}

function montar(inicial: Partial<AtaDraft> = {}) {
  const user = userEvent.setup();
  const r = renderizarComProvedores(
    <>
      <DadosBlock tipo={corporativa} />
      <ParticipantesBlock tipo={corporativa} />
      <TranscricaoBlock tipo={corporativa} />
    </>,
    { inicial: { ...criarRascunho('corporativa'), ...inicial } },
  );
  return { user, ...r };
}

function blocoTranscricao(): HTMLElement {
  return screen.getByRole('region', { name: 'Transcrição' });
}

function blocoParticipantes(): HTMLElement {
  return screen.getByRole('region', { name: 'Participantes' });
}

function blocoDados(): HTMLElement {
  return screen.getByRole('region', { name: 'Dados da reunião' });
}

function campoArquivo(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input[type="file"]');
  if (!(el instanceof HTMLInputElement)) throw new Error('input de arquivo não encontrado');
  return el;
}

const vtt = (conteudo: string, nome = 'reuniao.vtt') =>
  new File([conteudo], nome, { type: 'text/vtt' });

describe('participantes a partir de quem falou', () => {
  it('sugere quem falou; ao clicar, entram como presentes no bloco 3, com toast do que mudou', async () => {
    const { user } = montar({
      transcricao: [
        'Ana Souza: Bom dia.',
        'Bruno Lima: Olá.',
        'ana souza: De novo.',
        'Carla Dias: Oi.',
      ].join('\n'),
    });
    const sugestao = within(blocoTranscricao());
    expect(
      sugestao.getByText('Encontramos 3 pessoas que falaram: Ana Souza, Bruno Lima e Carla Dias.'),
    ).toBeInTheDocument();
    expect(
      sugestao.getByText(
        'Quem participou sem falar não aparece na transcrição — inclua à mão no bloco 3.',
      ),
    ).toBeInTheDocument();
    expect(
      within(blocoParticipantes()).getByText('Nenhum participante ainda.', { exact: false }),
    ).toBeInTheDocument();

    await user.click(sugestao.getByRole('button', { name: 'Adicionar como participantes' }));

    const lista = within(blocoParticipantes()).getByRole('region', {
      name: 'Lista de participantes',
    });
    const nomes = within(lista)
      .getAllByLabelText(/^Nome do participante/)
      .map((el) => (el as HTMLInputElement).value);
    expect(nomes).toEqual(['Ana Souza', 'Bruno Lima', 'Carla Dias']);
    expect(
      within(blocoParticipantes()).getByText('3 participantes · 3 presentes'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Notificações' })).getByText(
        '3 participantes adicionados ao bloco 3.',
      ),
    ).toBeInTheDocument();
    expect(sugestao.getByText('Todos os que falaram já estão na lista.')).toBeInTheDocument();
    expect(
      sugestao.queryByRole('button', { name: 'Adicionar como participantes' }),
    ).not.toBeInTheDocument();
  });

  it('quem já está na lista (sem diferença de caixa/acento) não é duplicado e é contado no toast', async () => {
    const { user } = montar({
      participantes: [participante(1, 'BRUNO LIMA'), participante(2, 'Ana Souza')],
      transcricao: ['Ana Souza: a', 'Bruno Lima: b', 'Carla Dias: c'].join('\n'),
    });
    const sugestao = within(blocoTranscricao());
    expect(sugestao.getByText(/2 já estão na lista\./)).toBeInTheDocument();
    await user.click(sugestao.getByRole('button', { name: 'Adicionar como participante' }));
    expect(
      screen.getByText('1 participante adicionado ao bloco 3 (2 já estavam na lista).'),
    ).toBeInTheDocument();
    expect(
      within(blocoParticipantes()).getByText('3 participantes · 3 presentes'),
    ).toBeInTheDocument();
  });

  it('no teto de participantes, não oferece o botão e explica', () => {
    montar({
      participantes: Array.from({ length: LIMITE_PARTICIPANTES }, (_, i) =>
        participante(i, `Pessoa ${String(i)}`),
      ),
      transcricao: 'Carla Dias: c',
    });
    const sugestao = within(blocoTranscricao());
    expect(
      sugestao.getByText(
        `A lista já tem o limite de ${String(LIMITE_PARTICIPANTES)} participantes: ninguém mais pode ser adicionado.`,
      ),
    ).toBeInTheDocument();
    expect(sugestao.queryByRole('button', { name: /^Adicionar como/ })).not.toBeInTheDocument();
  });

  it('sem falas "Nome: fala", nada é sugerido', () => {
    montar({ transcricao: 'Vamos começar a reunião.' });
    expect(within(blocoTranscricao()).queryByText(/^Encontramos/)).not.toBeInTheDocument();
  });

  it('um .vtt exportado (ids uuid, falas em várias linhas) sugere cada falante uma vez', async () => {
    const { user, container } = montar();
    await user.upload(campoArquivo(container), vtt(vttFicticio(36)));
    const sugestao = within(blocoTranscricao());
    expect(
      await sugestao.findByText(
        `Encontramos 4 pessoas que falaram: ${FALANTES_FICTICIOS.slice(0, 3).join(', ')} e ${FALANTES_FICTICIOS[3]}.`,
      ),
    ).toBeInTheDocument();
  });
});

describe('término a partir da duração do .vtt', () => {
  it('início vazio: diz a duração e pede o início; preenchido: oferece o término e preenche', async () => {
    const { user, container } = montar();
    await user.upload(campoArquivo(container), vtt(vttFicticio(36)));
    const dados = within(blocoDados());
    expect(
      await dados.findByText(
        'A transcrição dura 27 min — preencha o início para sugerirmos o término.',
      ),
    ).toBeInTheDocument();

    await user.type(dados.getByLabelText(/^Início/), '14:00');
    expect(dados.getByText('A transcrição dura 27 min.')).toBeInTheDocument();
    await user.click(dados.getByRole('button', { name: 'Preencher o término com 14h27' }));

    expect(dados.getByLabelText(/^Término/)).toHaveValue('14:27');
    expect(
      dados.getByText(
        'Término preenchido com 14h27 (início 14h + 27 min da transcrição). Ajuste se a reunião terminou em outro horário.',
      ),
    ).toBeInTheDocument();
    await user.click(dados.getByRole('button', { name: 'Desfazer' }));
    expect(dados.getByLabelText(/^Término/)).toHaveValue('');
  });

  it('término já preenchido nunca é sobrescrito nem sugerido', async () => {
    const { user, container } = montar({ dados: { inicio: '14:00', fim: '16:00' } });
    await user.upload(campoArquivo(container), vtt(vttFicticio(36)));
    await screen.findByDisplayValue(/Ana Souza:/);
    expect(within(blocoDados()).queryByText(/A transcrição dura/)).not.toBeInTheDocument();
    expect(within(blocoDados()).getByLabelText(/^Término/)).toHaveValue('16:00');
  });

  it('passaria da meia-noite: não sugere e diz por quê', async () => {
    const { user, container } = montar({ dados: { inicio: '23:50' } });
    await user.upload(campoArquivo(container), vtt(vttFicticio(36)));
    expect(
      await within(blocoDados()).findByText(
        'A transcrição dura 27 min: somada ao início (23h50), passaria da meia-noite. Preencha o término à mão.',
      ),
    ).toBeInTheDocument();
    expect(
      within(blocoDados()).queryByRole('button', { name: /^Preencher o término/ }),
    ).not.toBeInTheDocument();
  });

  it('.txt não tem tempos: nada de duração; Limpar a transcrição apaga a duração', async () => {
    const { user, container } = montar({ dados: { inicio: '14:00' } });
    await user.upload(campoArquivo(container), vtt(vttFicticio(36)));
    expect(await within(blocoDados()).findByText('A transcrição dura 27 min.')).toBeInTheDocument();
    await user.click(within(blocoTranscricao()).getByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      expect(within(blocoDados()).queryByText(/A transcrição dura/)).not.toBeInTheDocument();
    });
    // Desfazer o Limpar devolve o texto E a duração.
    await user.click(within(blocoTranscricao()).getByRole('button', { name: 'Desfazer' }));
    expect(within(blocoDados()).getByText('A transcrição dura 27 min.')).toBeInTheDocument();

    await user.upload(
      campoArquivo(container),
      new File(['Ana: oi'], 'r.txt', { type: 'text/plain' }),
    );
    await screen.findByDisplayValue('Ana: oi');
    expect(within(blocoDados()).queryByText(/A transcrição dura/)).not.toBeInTheDocument();
  });
});
