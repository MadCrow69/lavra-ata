import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import type { AtaTypeDefinition } from '../../ata-types/types';
import { LIMITE_PARTICIPANTES } from '../../config/limits';
import { DraftProvider } from '../../domain/DraftContext';
import type { AtaDraft, Participante } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { DadosBlock } from './DadosBlock';
import { ParticipantesBlock } from './ParticipantesBlock';
import { TipoBlock } from './TipoBlock';

function participante(i: number, parcial: Partial<Participante> = {}): Participante {
  return {
    id: `p${String(i)}`,
    nome: `Pessoa ${String(i)}`,
    papel: '',
    presenca: 'presente',
    justificativa: '',
    extras: {},
    ...parcial,
  };
}

function rascunhoCom(parcial: Partial<AtaDraft>): AtaDraft {
  return { ...criarRascunho(), ...parcial };
}

function comParticipantes(n: number, parcial: (i: number) => Partial<Participante> = () => ({})) {
  return rascunhoCom({
    participantes: Array.from({ length: n }, (_, i) => participante(i + 1, parcial(i + 1))),
  });
}

function renderizar(ui: React.ReactNode, inicial?: AtaDraft) {
  return render(<DraftProvider {...(inicial ? { inicial } : {})}>{ui}</DraftProvider>);
}

/**
 * Com centenas de linhas, `getByRole` e `userEvent` ficam lentos no jsdom (varrem a árvore toda):
 * os testes de volume usam consultas por texto/rótulo e `fireEvent`, que medem o app, não o utilitário.
 */
function colarPelaTela(texto: string): void {
  fireEvent.click(screen.getByText('Colar lista'));
  fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), { target: { value: texto } });
  fireEvent.click(screen.getByText('Adicionar à lista'));
}

function avisoAtual(): HTMLElement {
  const aviso = document.querySelector<HTMLElement>('[role="status"]');
  if (!aviso) throw new Error('Nenhum aviso (role="status") na tela.');
  return aviso;
}

/** Teto de tempo dos testes que montam 200 a 500 linhas: o jsdom é lento e a suíte roda em paralelo. */
const TEMPO_VOLUME_MS = 30_000;

function linhas(n: number): string {
  return Array.from(
    { length: n },
    (_, i) => `Participante Número ${String(i + 1)} — Cargo ${String(i + 1)}`,
  ).join('\n');
}

describe('DadosBlock', () => {
  it('sair do campo data vazio mostra o erro abaixo do campo, em pt-BR', async () => {
    const user = userEvent.setup();
    renderizar(<DadosBlock tipo={corporativa} />);

    const data = screen.getByLabelText(/^Data/);
    expect(screen.queryByText('Informe a data da reunião.')).not.toBeInTheDocument();
    await user.click(data);
    await user.tab();

    const erro = screen.getByText('Informe a data da reunião.');
    expect(erro).toBeVisible();
    expect(data).toHaveAttribute('aria-invalid', 'true');
    expect(data).toHaveAccessibleDescription('Informe a data da reunião.');
  });

  it('o erro some quando o campo é preenchido', async () => {
    const user = userEvent.setup();
    renderizar(<DadosBlock tipo={corporativa} />);

    const assunto = screen.getByLabelText(/^Assunto/);
    await user.click(assunto);
    await user.tab();
    expect(screen.getByText('Informe o assunto da reunião.')).toBeVisible();

    await user.type(assunto, 'Planejamento');
    expect(screen.queryByText('Informe o assunto da reunião.')).not.toBeInTheDocument();
    expect(assunto).toHaveAttribute('aria-invalid', 'false');
  });

  it('marca obrigatórios com * e aria-required; opcionais ficam sem', () => {
    renderizar(<DadosBlock tipo={corporativa} />);
    expect(screen.getByLabelText(/^Organização/)).toBeRequired();
    expect(screen.getByLabelText(/^Organização/).closest('div')).toHaveTextContent('*');
    expect(screen.getByLabelText(/^Término/)).not.toBeRequired();
    expect(screen.getByLabelText(/^Condução/)).not.toBeRequired();
  });

  it('local vira Plataforma na reunião remota e é opcional; presencial exige', async () => {
    const user = userEvent.setup();
    renderizar(<DadosBlock tipo={corporativa} />);

    await user.selectOptions(screen.getByLabelText(/^Modalidade/), 'remota');
    const plataforma = screen.getByLabelText(/^Plataforma/);
    expect(plataforma).not.toBeRequired();
    expect(screen.queryByLabelText(/^Local/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Modalidade/), 'presencial');
    const local = screen.getByLabelText(/^Local/);
    expect(local).toBeRequired();
    await user.click(local);
    await user.tab();
    expect(screen.getByText('Informe o local da reunião.')).toBeVisible();
  });

  it('pauta aceita um item por linha, com Enter, e deixa de faltar', async () => {
    const user = userEvent.setup();
    renderizar(<DadosBlock tipo={corporativa} />);

    expect(screen.getByText(/falta:.*Pauta/)).toBeVisible();
    const pauta = screen.getByLabelText(/^Pauta/);
    await user.type(pauta, 'Metas do trimestre{Enter}Orçamento{Enter}');
    expect(pauta).toHaveValue('Metas do trimestre\nOrçamento\n');
    expect(screen.queryByText(/falta:.*Pauta/)).not.toBeInTheDocument();
  });

  it('mostra "falta: Data, Pauta" quando só esses faltam', () => {
    renderizar(
      <DadosBlock tipo={corporativa} />,
      rascunhoCom({
        dados: {
          organizacao: 'Empresa Exemplo Ltda.',
          assunto: 'Planejamento',
          inicio: '14:30',
          modalidade: 'remota',
        },
      }),
    );
    expect(screen.getByText('falta: Data, Pauta')).toBeVisible();
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('mostra ✓ quando o bloco está completo', () => {
    renderizar(
      <DadosBlock tipo={corporativa} />,
      rascunhoCom({
        dados: {
          organizacao: 'Empresa Exemplo Ltda.',
          assunto: 'Planejamento',
          data: '2026-10-14',
          inicio: '14:30',
          modalidade: 'remota',
        },
        pauta: ['Metas'],
      }),
    );
    expect(screen.getByText('✓')).toBeVisible();
    expect(screen.queryByText(/falta:/)).not.toBeInTheDocument();
  });

  it('o bloco recolhe e expande pelo cabeçalho', async () => {
    const user = userEvent.setup();
    renderizar(<DadosBlock tipo={corporativa} />);

    const cabecalho = screen.getByRole('button', { name: /Dados da reunião/ });
    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/^Organização/)).toBeVisible();

    await user.click(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText(/^Organização/)).not.toBeVisible();
  });
});

describe('TipoBlock', () => {
  it('lista os tipos disponíveis com o padrão marcado e conta como completo', () => {
    renderizar(<TipoBlock />);
    expect(screen.getByRole('radio', { name: /Reunião corporativa/ })).toBeChecked();
    expect(screen.getByText('✓')).toBeVisible();
  });

  it('troca o tom da redação', async () => {
    const user = userEvent.setup();
    renderizar(<TipoBlock />);
    const tom = screen.getByLabelText(/Tom da redação/);
    expect(tom).toHaveValue('formal');
    await user.selectOptions(tom, 'conciso');
    expect(tom).toHaveValue('conciso');
  });
});

describe('ParticipantesBlock', () => {
  it('vazio: explica como começar e mostra o que falta', () => {
    renderizar(<ParticipantesBlock tipo={corporativa} />);
    expect(screen.getByText(/Nenhum participante ainda/)).toBeVisible();
    expect(screen.getByText('0 participantes · 0 presentes')).toBeVisible();
    expect(screen.getByText('falta: Participante presente')).toBeVisible();
  });

  it(
    'colar 200 linhas cria 200 participantes em menos de 2 s no jsdom',
    () => {
      renderizar(<ParticipantesBlock tipo={corporativa} />);

      fireEvent.click(screen.getByText('Colar lista'));
      const area = screen.getByLabelText(/Nomes, um por linha/);
      const adicionar = screen.getByText('Adicionar à lista');
      const texto = linhas(200);

      // Só a ação de colar entra na medida: buscar elementos na tela não é custo do app.
      // O tempo em navegador real é verificado no E2E; aqui o teto é só contra regressão grosseira.
      const inicio = performance.now();
      fireEvent.change(area, { target: { value: texto } });
      fireEvent.click(adicionar);
      const duracao = performance.now() - inicio;

      expect(screen.getByText('200 participantes · 200 presentes')).toBeVisible();
      expect(screen.getAllByLabelText(/^Nome do participante /)).toHaveLength(200);
      expect(duracao).toBeLessThan(2000);
    },
    TEMPO_VOLUME_MS,
  );

  it('"Nome — Cargo" preenche o cargo e a área é limpa depois de adicionar', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />);

    await user.click(screen.getByRole('button', { name: 'Colar lista' }));
    fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
      target: { value: 'Ana Souza — Diretora\nBruno Lima' },
    });
    await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));

    expect(screen.getByLabelText('Nome do participante 1')).toHaveValue('Ana Souza');
    expect(screen.getByLabelText('Cargo / empresa do participante 1')).toHaveValue('Diretora');
    expect(screen.getByLabelText('Nome do participante 2')).toHaveValue('Bruno Lima');
    expect(screen.getByLabelText('Cargo / empresa do participante 2')).toHaveValue('');
    expect(screen.queryByLabelText(/Nomes, um por linha/)).not.toBeInTheDocument();
  });

  it(
    'avisa quantos nomes foram ignorados pelo limite',
    () => {
      renderizar(
        <ParticipantesBlock tipo={corporativa} />,
        comParticipantes(LIMITE_PARTICIPANTES - 2),
      );
      colarPelaTela(linhas(5));

      expect(avisoAtual()).toHaveTextContent('3 nomes ignorados: o limite é 500 participantes.');
      expect(screen.getByText('500 participantes · 500 presentes')).toBeVisible();
    },
    TEMPO_VOLUME_MS,
  );

  it(
    'no singular: "1 nome ignorado"',
    () => {
      renderizar(
        <ParticipantesBlock tipo={corporativa} />,
        comParticipantes(LIMITE_PARTICIPANTES - 1),
      );
      colarPelaTela(linhas(2));
      expect(avisoAtual()).toHaveTextContent('1 nome ignorado: o limite é 500 participantes.');
    },
    TEMPO_VOLUME_MS,
  );

  it(
    'lista cheia: nada é adicionado e a pessoa é avisada',
    () => {
      renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(LIMITE_PARTICIPANTES));
      colarPelaTela(linhas(2));
      expect(avisoAtual()).toHaveTextContent('2 nomes ignorados: o limite é 500 participantes.');
      expect(screen.getByText('500 participantes · 500 presentes')).toBeVisible();
    },
    TEMPO_VOLUME_MS,
  );

  it('adicionar um participante: nome + Enter cria a linha, limpa o campo e devolve o foco', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />);

    const nome = screen.getByLabelText(/^Nome do novo participante/);
    await user.type(nome, 'Ana Souza{Enter}');

    expect(screen.getByLabelText('Nome do participante 1')).toHaveValue('Ana Souza');
    expect(screen.getByText('1 participante · 1 presente')).toBeVisible();
    expect(nome).toHaveValue('');
    expect(nome).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('1 participante adicionado.');

    await user.type(nome, 'Bruno Lima');
    await user.type(screen.getByLabelText(/^Cargo \/ empresa \(opcional\)/), 'Analista');
    await user.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    expect(screen.getByLabelText('Nome do participante 2')).toHaveValue('Bruno Lima');
    expect(screen.getByLabelText('Cargo / empresa do participante 2')).toHaveValue('Analista');
    expect(nome).toHaveFocus();
  });

  it('adicionar com nome vazio mostra o erro sob o campo e não cria linha', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />);

    const nome = screen.getByLabelText(/^Nome do novo participante/);
    await user.click(nome);
    await user.keyboard('{Enter}');
    expect(screen.getByText('Informe o nome do participante.')).toBeVisible();
    expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('0 participantes · 0 presentes')).toBeVisible();

    await user.type(nome, 'Ana');
    expect(screen.queryByText('Informe o nome do participante.')).not.toBeInTheDocument();
  });

  it(
    'lista cheia: adicionar um nome avisa o limite e não apaga o que foi digitado',
    () => {
      renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(LIMITE_PARTICIPANTES));
      const nome = screen.getByLabelText(/^Nome do novo participante/);
      fireEvent.change(nome, { target: { value: 'Ana' } });
      const formulario = nome.closest('form');
      if (!formulario) throw new Error('Formulário de novo participante ausente.');
      fireEvent.submit(formulario);

      expect(avisoAtual()).toHaveTextContent(
        'Nenhum nome foi adicionado. 1 nome ignorado: o limite é 500 participantes.',
      );
      expect(nome).toHaveValue('Ana');
    },
    TEMPO_VOLUME_MS,
  );

  it('o estado vazio ensina a digitar um nome ou colar a lista', () => {
    renderizar(<ParticipantesBlock tipo={corporativa} />);
    expect(screen.getByText(/Digite um nome acima e tecle Enter/)).toBeVisible();
  });

  it('avisa quantos nomes colados já estavam na lista, sem diferenciar caixa e acento', async () => {
    const user = userEvent.setup();
    renderizar(
      <ParticipantesBlock tipo={corporativa} />,
      comParticipantes(2, (i) => (i === 1 ? { nome: 'João da Conceição' } : {})),
    );
    await user.click(screen.getByRole('button', { name: 'Colar lista' }));
    fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
      target: { value: 'JOAO DA CONCEICAO\nPessoa 2\nMaria Nova' },
    });
    await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      '3 participantes adicionados · 2 já estavam na lista (mantidos em duplicidade — remova se não for o caso).',
    );
    expect(screen.getByText('5 participantes · 5 presentes')).toBeVisible();
  });

  it('o aviso some quando a lista muda por outro caminho (editar ou remover)', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />);
    const nome = screen.getByLabelText(/^Nome do novo participante/);

    await user.type(nome, 'Ana{Enter}');
    expect(screen.getByRole('status')).toBeVisible();
    await user.type(screen.getByLabelText('Nome do participante 1'), 'x');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.type(nome, 'Bia{Enter}');
    expect(screen.getByRole('status')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remover Bia' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('linha com nome apagado mostra o texto "Informe o nome." ligado ao campo', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(2));
    const campo = screen.getByLabelText('Nome do participante 2');
    expect(screen.queryByText('Informe o nome.')).not.toBeInTheDocument();

    await user.clear(campo);
    expect(screen.getByText('Informe o nome.')).toBeVisible();
    expect(campo).toHaveAccessibleDescription('Informe o nome.');
  });

  it('busca só aparece com mais de 20 linhas e ignora acento e caixa', async () => {
    const user = userEvent.setup();
    const { unmount } = renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(20));
    expect(screen.queryByLabelText('Buscar participante')).not.toBeInTheDocument();
    unmount();

    renderizar(
      <ParticipantesBlock tipo={corporativa} />,
      comParticipantes(30, (i) => (i === 7 ? { nome: 'João da Conceição' } : {})),
    );
    const busca = screen.getByLabelText('Buscar participante');
    await user.type(busca, 'JOAO da CONCEI');
    expect(screen.getAllByLabelText(/^Nome do participante /)).toHaveLength(1);
    expect(screen.getByLabelText('Nome do participante 7')).toHaveValue('João da Conceição');

    await user.clear(busca);
    await user.type(busca, 'inexistente');
    expect(screen.getByText(/Nenhum participante encontrado/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(screen.getAllByLabelText(/^Nome do participante /)).toHaveLength(30);
  });

  it('com mais de 20 linhas a tabela ganha rolagem; com 20 ou menos, não', () => {
    const { unmount } = renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(21));
    expect(screen.getByRole('region', { name: 'Lista de participantes' })).toHaveAttribute(
      'data-rolagem',
      'true',
    );
    unmount();
    renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(20));
    expect(screen.getByRole('region', { name: 'Lista de participantes' })).toHaveAttribute(
      'data-rolagem',
      'false',
    );
  });

  it('marcar todos como presentes atualiza o contador', async () => {
    const user = userEvent.setup();
    renderizar(
      <ParticipantesBlock tipo={corporativa} />,
      comParticipantes(3, (i) => ({ presenca: i === 1 ? 'presente' : 'ausente' })),
    );
    expect(screen.getByText('3 participantes · 1 presente')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Marcar todos como presentes' }));
    expect(screen.getByText('3 participantes · 3 presentes')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Marcar todos como presentes' })).toBeDisabled();
  });

  it('presença "justificado" abre o campo de justificativa', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(2));
    expect(screen.queryByLabelText(/^Justificativa/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Presença de Pessoa 2'), 'justificado');
    const justificativa = screen.getByLabelText('Justificativa de Pessoa 2');
    await user.type(justificativa, 'Viagem a trabalho');
    expect(justificativa).toHaveValue('Viagem a trabalho');
    expect(screen.getByText('2 participantes · 1 presente')).toBeVisible();
  });

  it('remove um participante pelo botão da linha', async () => {
    const user = userEvent.setup();
    renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(3));
    await user.click(screen.getByRole('button', { name: 'Remover Pessoa 2' }));
    expect(screen.getByText('2 participantes · 2 presentes')).toBeVisible();
    expect(screen.queryByDisplayValue('Pessoa 2')).not.toBeInTheDocument();
  });

  it(
    'com 200 linhas, editar o nome de uma linha funciona e o cabeçalho continua único',
    async () => {
      const user = userEvent.setup();
      renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(200));
      const tabela = screen.getByRole('table');
      expect(within(tabela).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(4);

      const nome = screen.getByLabelText('Nome do participante 150');
      await user.clear(nome);
      await user.type(nome, 'Renomeado');
      expect(nome).toHaveValue('Renomeado');
      expect(screen.getByText('200 participantes · 200 presentes')).toBeVisible();
    },
    TEMPO_VOLUME_MS,
  );

  it('mostra ✓ com ao menos um presente e "falta" quando todos estão ausentes', () => {
    const { unmount } = renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(2));
    expect(screen.getByText('✓')).toBeVisible();
    unmount();
    renderizar(
      <ParticipantesBlock tipo={corporativa} />,
      comParticipantes(2, () => ({ presenca: 'ausente' })),
    );
    expect(screen.getByText('falta: Participante presente')).toBeVisible();
  });

  it('renderiza campos extras do participante definidos pelo tipo', async () => {
    const user = userEvent.setup();
    const tipo: AtaTypeDefinition = {
      ...corporativa,
      camposParticipante: [{ id: 'unidade', rotulo: 'Unidade', tipo: 'texto', obrigatorio: true }],
    };
    renderizar(<ParticipantesBlock tipo={tipo} />, comParticipantes(1));
    expect(screen.getByText('falta: Unidade')).toBeVisible();
    await user.type(screen.getByLabelText('Unidade do participante 1'), '12');
    expect(screen.queryByText(/falta:/)).not.toBeInTheDocument();
  });
});

describe('ParticipantesBlock no celular (lista longa recolhida)', () => {
  /** Tela estreita: casa a consulta dos cartões (`max-width`), não a de duas colunas. */
  function simularCelular(): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const nomesNaTela = () => document.querySelectorAll('[data-campo="nome"]').length;

  it(
    '200 participantes: começa recolhida, com resumo, busca e adição à vista; o botão expande e recolhe',
    () => {
      simularCelular();
      renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(200));

      expect(nomesNaTela()).toBe(0);
      expect(screen.getByText('200 participantes · 200 presentes')).toBeVisible();
      expect(screen.getByLabelText('Buscar participante')).toBeVisible();
      expect(screen.getByLabelText(/^Nome do novo participante/)).toBeVisible();
      expect(screen.getByText('Colar lista')).toBeVisible();

      const alternar = screen.getByText('Mostrar os 200 participantes');
      expect(alternar).toHaveAttribute('aria-expanded', 'false');
      const alvo = alternar.getAttribute('aria-controls') ?? '';
      expect(document.getElementById(alvo)).not.toBeNull();

      fireEvent.click(alternar);
      expect(nomesNaTela()).toBe(200);
      expect(alternar).toHaveTextContent('Ocultar a lista');
      expect(alternar).toHaveAttribute('aria-expanded', 'true');
      expect(
        document.getElementById(alvo)?.contains(screen.getByLabelText('Nome do participante 150')),
      ).toBe(true);

      fireEvent.click(alternar);
      expect(nomesNaTela()).toBe(0);
    },
    TEMPO_VOLUME_MS,
  );

  it('na lista recolhida, a busca mostra só o que casa; limpar a busca recolhe de novo', () => {
    simularCelular();
    renderizar(
      <ParticipantesBlock tipo={corporativa} />,
      comParticipantes(200, (i) => (i === 42 ? { nome: 'João da Conceição' } : {})),
    );
    const busca = screen.getByLabelText('Buscar participante');
    fireEvent.change(busca, { target: { value: 'joao' } });
    expect(nomesNaTela()).toBe(1);
    expect(screen.getByLabelText('Nome do participante 42')).toHaveValue('João da Conceição');
    expect(screen.queryByText(/^Mostrar os/)).not.toBeInTheDocument();

    fireEvent.change(busca, { target: { value: '' } });
    expect(nomesNaTela()).toBe(0);
    expect(screen.getByText('Mostrar os 200 participantes')).toBeVisible();
  });

  it('na lista recolhida, quem está sem nome continua à vista para correção', () => {
    simularCelular();
    renderizar(
      <ParticipantesBlock tipo={corporativa} />,
      comParticipantes(30, (i) => (i === 9 ? { nome: '' } : {})),
    );
    expect(nomesNaTela()).toBe(1);
    expect(screen.getByLabelText('Nome do participante 9')).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('1 participante sem nome continua à vista para correção.'),
    ).toBeVisible();
  });

  it('com até 20 participantes ou em tela larga, nada se recolhe', () => {
    simularCelular();
    const { unmount } = renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(20));
    expect(nomesNaTela()).toBe(20);
    expect(screen.queryByText(/^Mostrar os/)).not.toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    renderizar(<ParticipantesBlock tipo={corporativa} />, comParticipantes(30));
    expect(nomesNaTela()).toBe(30);
  });
});
