import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { corporativa } from '../../ata-types/corporativa';
import type { AtaTypeDefinition } from '../../ata-types/types';
import { LIMITE_PARTICIPANTES } from '../../config/limits';
import { ESPERA_ANUNCIO_RESUMO_MS } from '../../config/ui';
import type { AtaDraft, Participante } from '../../domain/draft';
import { criarRascunho } from '../../domain/draft-reducer';
import { TIPO_DE_TESTE } from '../../test/tipo-de-teste';
import { DadosBlock } from './DadosBlock';
import { ParticipantesBlock } from './ParticipantesBlock';
import { TipoBlock } from './TipoBlock';
import { renderizarComProvedores } from '../../test/provedores';
import { TEMPO_VOLUME_MS } from '../../test/tempos';

/**
 * Teto da espera pelo anúncio adiado do resumo: bem acima da espera do próprio anúncio, porque a
 * máquina é compartilhada e o `waitFor` padrão (1 s) deixava só 400 ms de folga.
 */
const ATE_O_ANUNCIO = { timeout: ESPERA_ANUNCIO_RESUMO_MS + 5_000 };

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
  return renderizarComProvedores(ui, inicial ? { inicial } : {});
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

describe('formulário guiado pelo tipo de ata (tipo de teste)', () => {
  function membros(n: number, parcial: (i: number) => Partial<Participante> = () => ({})) {
    return {
      ...criarRascunho(TIPO_DE_TESTE.id),
      participantes: Array.from({ length: n }, (_, i) =>
        participante(i + 1, {
          extras: { unidade: `Apto ${String(100 + i + 1)}`, vinculo: 'proprietario' },
          ...parcial(i + 1),
        }),
      ),
    };
  }

  describe('DadosBlock', () => {
    it('usa o título da pauta do tipo (rótulo, falta e erro)', async () => {
      const user = userEvent.setup();
      renderizar(<DadosBlock tipo={TIPO_DE_TESTE} />);
      const pauta = screen.getByLabelText(/^Ordem do dia/);
      expect(screen.queryByLabelText(/^Pauta/)).not.toBeInTheDocument();
      expect(screen.getByText(/falta:.*Ordem do dia/)).toBeVisible();
      await user.click(pauta);
      await user.tab();
      expect(screen.getByText('Informe ao menos um item em “Ordem do dia”.')).toBeVisible();
    });

    it('formato inválido de campo opcional aparece ao sair do campo, com teclado numérico', async () => {
      const user = userEvent.setup();
      renderizar(<DadosBlock tipo={TIPO_DE_TESTE} />);
      const codigo = screen.getByLabelText(/^Código/);
      expect(codigo).toHaveAttribute('inputmode', 'numeric');
      await user.type(codigo, 'abc');
      expect(screen.queryByText('Use só números.')).not.toBeInTheDocument();
      await user.tab();
      expect(screen.getByText('Use só números.')).toBeVisible();
      expect(codigo).toHaveAttribute('aria-invalid', 'true');
      expect(codigo).toHaveAccessibleDescription('Use só números.');
      expect(screen.getByText(/falta:.*Código \(corrigir\)/)).toBeVisible();
    });

    it('escolha vinda de outro tipo (fora das opções) mostra "Selecione…" e a falta', () => {
      renderizar(
        <DadosBlock tipo={TIPO_DE_TESTE} />,
        rascunhoCom({ tipoId: TIPO_DE_TESTE.id, dados: { modalidade: 'remota' } }),
      );
      expect(screen.getByLabelText(/^Modalidade/)).toHaveValue('');
      expect(screen.getByText(/falta:.*Modalidade \(corrigir\)/)).toBeVisible();
    });
  });

  describe('ParticipantesBlock', () => {
    it('título, colunas e células seguem o tipo, sem coluna de papel', () => {
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />, membros(2));
      expect(screen.getByRole('region', { name: 'Membros' })).toBeVisible();
      const tabela = screen.getByRole('table');
      const cabecalhos = within(tabela)
        .getAllByRole('columnheader')
        .map((c) => c.textContent);
      expect(cabecalhos).toEqual([
        'Nome',
        'Unidade',
        'Vínculo',
        'Fração ideal',
        'Presença',
        'Ação',
      ]);
      expect(screen.queryByLabelText(/^Cargo/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Unidade do participante 2')).toHaveValue('Apto 102');
      expect(screen.getByLabelText('Vínculo do participante 1')).toHaveValue('proprietario');
    });

    it('coluna de extra que o tipo esconde para os dados não aparece', () => {
      const tipo: AtaTypeDefinition = {
        ...TIPO_DE_TESTE,
        camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
          c.id === 'fracao' ? { ...c, visivelSe: (d) => d.natureza === 'extraordinaria' } : c,
        ),
      };
      renderizar(<ParticipantesBlock tipo={tipo} />, membros(1));
      expect(screen.queryByLabelText('Fração ideal do participante 1')).not.toBeInTheDocument();
    });

    it('"Colar lista" com “Nome — X” grava X no campo de complemento do tipo', async () => {
      const user = userEvent.setup();
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />);
      await user.click(screen.getByRole('button', { name: 'Colar lista' }));
      expect(screen.getByText('Aceita “Nome — Unidade”.')).toBeVisible();
      fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
        target: { value: 'Ana Souza — Apto 101\nBruno Lima' },
      });
      await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
      expect(screen.getByLabelText('Nome do participante 1')).toHaveValue('Ana Souza');
      expect(screen.getByLabelText('Unidade do participante 1')).toHaveValue('Apto 101');
      expect(screen.getByLabelText('Unidade do participante 2')).toHaveValue('');
    });

    it('adicionar um participante usa o rótulo do campo de complemento', async () => {
      const user = userEvent.setup();
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />);
      await user.type(screen.getByLabelText(/^Nome do novo participante/), 'Ana Souza');
      await user.type(screen.getByLabelText(/^Unidade/), 'Apto 7');
      await user.click(screen.getByRole('button', { name: 'Adicionar participante' }));
      expect(screen.getByLabelText('Unidade do participante 1')).toHaveValue('Apto 7');
    });

    it('mesmo nome em unidades diferentes não é duplicidade; mesmo nome e unidade é', async () => {
      const user = userEvent.setup();
      renderizar(
        <ParticipantesBlock tipo={TIPO_DE_TESTE} />,
        membros(1, () => ({ nome: 'Ana Souza', extras: { unidade: 'Apto 101' } })),
      );
      const colar = async (texto: string) => {
        await user.click(screen.getByRole('button', { name: 'Colar lista' }));
        fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
          target: { value: texto },
        });
        await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
      };
      await colar('ana souza — apto 102');
      expect(screen.getByText('1 participante adicionado.')).toBeVisible();
      await colar('Ana Souza — Apto 101');
      expect(screen.getByText(/1 já estava na lista/)).toBeVisible();
    });

    it('unidade sem número mostra a mensagem na célula e a falta “(corrigir)”', async () => {
      const user = userEvent.setup();
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />, membros(2));
      const celula = screen.getByLabelText('Unidade do participante 1');
      expect(screen.queryByText(/falta:/)).not.toBeInTheDocument();
      await user.clear(celula);
      await user.type(celula, 'Apto');
      expect(screen.getByText('Informe a unidade com número (ex.: Apto 101).')).toBeVisible();
      expect(celula).toHaveAttribute('aria-invalid', 'true');
      expect(celula).toHaveAccessibleDescription('Informe a unidade com número (ex.: Apto 101).');
      expect(screen.getByLabelText('Unidade do participante 2')).toHaveAttribute(
        'aria-invalid',
        'false',
      );
      expect(screen.getByText('falta: Unidade (corrigir)')).toBeVisible();
    });

    it('“Preencher os vazios — Vínculo” aplica só a quem está sem valor e anuncia', async () => {
      const user = userEvent.setup();
      renderizar(
        <ParticipantesBlock tipo={TIPO_DE_TESTE} />,
        membros(4, (i) => ({
          extras: { unidade: `Apto ${String(i)}`, ...(i === 1 ? { vinculo: 'procurador' } : {}) },
        })),
      );
      const grupo = screen.getByRole('group', { name: 'Preencher os vazios — Vínculo' });
      const aplicar = within(grupo).getByRole('button', { name: 'Aplicar — Vínculo' });
      expect(aplicar).toBeDisabled();
      await user.selectOptions(within(grupo).getByRole('combobox'), 'proprietario');
      await user.click(aplicar);
      expect(screen.getByLabelText('Vínculo do participante 1')).toHaveValue('procurador');
      for (const n of [2, 3, 4]) {
        expect(screen.getByLabelText(`Vínculo do participante ${String(n)}`)).toHaveValue(
          'proprietario',
        );
      }
      expect(
        screen.getByText('Vínculo “Proprietário(a)” aplicado a 3 participantes sem valor.'),
      ).toHaveAttribute('role', 'status');
      // Ninguém sem valor: o controle fica parado.
      expect(within(grupo).getByRole('button', { name: 'Aplicar — Vínculo' })).toBeDisabled();
    });

    it('“Desfazer” devolve ao estado de antes só os participantes preenchidos', async () => {
      const user = userEvent.setup();
      renderizar(
        <ParticipantesBlock tipo={TIPO_DE_TESTE} />,
        membros(3, (i) => ({
          extras: { unidade: `Apto ${String(i)}`, ...(i === 1 ? { vinculo: 'procurador' } : {}) },
        })),
      );
      const grupo = screen.getByRole('group', { name: 'Preencher os vazios — Vínculo' });
      await user.selectOptions(within(grupo).getByRole('combobox'), 'proprietario');
      await user.click(within(grupo).getByRole('button', { name: 'Aplicar — Vínculo' }));
      await user.click(screen.getByRole('button', { name: 'Desfazer' }));
      expect(screen.getByLabelText('Vínculo do participante 1')).toHaveValue('procurador');
      expect(screen.getByLabelText('Vínculo do participante 2')).toHaveValue('');
      expect(screen.getByLabelText('Vínculo do participante 3')).toHaveValue('');
      expect(
        screen.getByText('Preenchimento desfeito: 2 participantes voltaram a ficar sem valor.'),
      ).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    });

    it('valor fora das opções aparece no controle como “com valor inválido”', () => {
      renderizar(
        <ParticipantesBlock tipo={TIPO_DE_TESTE} />,
        membros(3, (i) => ({
          extras: { unidade: `Apto ${String(i)}`, vinculo: i === 1 ? 'remota' : 'proprietario' },
        })),
      );
      const grupo = screen.getByRole('group', { name: 'Preencher os vazios — Vínculo' });
      expect(within(grupo).getByText('1 com valor inválido — corrija na lista.')).toBeVisible();
    });

    it('extras vazios viram UMA linha por coluna; as células só marcam aria-invalid', () => {
      renderizar(
        <ParticipantesBlock tipo={TIPO_DE_TESTE} />,
        membros(3, (i) => ({ extras: { unidade: i === 3 ? '' : `Apto ${String(i)}` } })),
      );
      // Vínculo vazio nas 3 linhas e Unidade vazia em 1: nenhuma repetição por célula.
      expect(screen.queryByText(/Preencha o campo/)).not.toBeInTheDocument();
      const resumoVinculo = screen.getByText('Vínculo: 3 participantes sem valor.');
      expect(screen.getByText('Unidade: 1 participante sem valor.')).toBeVisible();
      for (const n of [1, 2, 3]) {
        const celula = screen.getByLabelText(`Vínculo do participante ${String(n)}`);
        expect(celula).toHaveAttribute('aria-invalid', 'true');
        expect(celula).toHaveAccessibleDescription('Vínculo: 3 participantes sem valor.');
      }
      expect(screen.getByLabelText('Unidade do participante 1')).toHaveAttribute(
        'aria-invalid',
        'false',
      );
      expect(resumoVinculo).toBeVisible();
    });

    it('a busca cobre os campos extras (“101” acha “Apto 101”)', async () => {
      const user = userEvent.setup();
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />, membros(30));
      await user.type(screen.getByLabelText('Buscar participante'), '101');
      expect(screen.getAllByLabelText(/^Nome do participante /)).toHaveLength(1);
      expect(screen.getByLabelText('Unidade do participante 1')).toHaveValue('Apto 101');
    });

    it('a tabela declara quantas colunas de dados tem (limiar dos cartões no CSS)', () => {
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />, membros(2));
      const tabela = screen.getByRole('table');
      const cabecalhos = within(tabela).getAllByRole('columnheader');
      // Todas menos a da ação.
      expect(tabela).toHaveAttribute('data-colunas', String(cabecalhos.length - 1));
    });

    it('resumo do tipo: texto e alertas à vista, lidos UMA vez (pela região status)', () => {
      renderizar(
        <ParticipantesBlock tipo={TIPO_DE_TESTE} />,
        membros(3, (i) => (i > 1 ? { presenca: 'ausente' } : {})),
      );
      // À vista, mas fora da árvore de acessibilidade: o leitor de tela ouve a região status.
      const texto = screen.getByText('3 unidades informadas', { selector: 'p:not([role])' });
      expect(texto).toHaveAttribute('aria-hidden', 'true');
      const alerta = screen.getByText(/Menos de dois membros presentes\./, {
        selector: 'p:not([role])',
      });
      expect(alerta).toHaveAttribute('aria-hidden', 'true');
      const anunciados = screen
        .getAllByRole('status')
        .filter((el) => el.textContent.includes('unidades informadas'));
      expect(anunciados.map((el) => el.textContent)).toEqual([
        '3 unidades informadas Menos de dois membros presentes.',
      ]);
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });

    it('alerta sem texto de resumo (ex.: soma acima do total) também é anunciado', async () => {
      const user = userEvent.setup();
      const tipo: AtaTypeDefinition = {
        ...TIPO_DE_TESTE,
        resumoDosParticipantes: ({ participantes }) =>
          participantes.some((p) => (p.extras.unidade ?? '').endsWith('0'))
            ? { texto: null, alertas: ['Soma acima do total.'] }
            : { texto: 'Soma conferida.', alertas: [] },
      };
      renderizar(<ParticipantesBlock tipo={tipo} />, membros(1));
      const anunciado = () =>
        screen
          .getAllByRole('status')
          .map((el) => el.textContent)
          .filter((t) => t.startsWith('Soma'));
      expect(anunciado()).toEqual(['Soma conferida.']);
      await user.type(screen.getByLabelText('Unidade do participante 1'), '0');
      await waitFor(() => {
        expect(anunciado()).toEqual(['Soma acima do total.']);
      }, ATE_O_ANUNCIO);
    });

    it('o resumo anunciado acompanha o texto vigente, mas só depois de parar de digitar', async () => {
      const user = userEvent.setup();
      const tipo: AtaTypeDefinition = {
        ...TIPO_DE_TESTE,
        resumoDosParticipantes: ({ participantes }) => ({
          texto: `Unidades: ${participantes.map((p) => p.extras.unidade ?? '').join(' / ')} · Presentes: ${String(participantes.filter((p) => p.presenca === 'presente').length)}`,
          alertas: [],
        }),
      };
      renderizar(<ParticipantesBlock tipo={tipo} />, membros(1));
      const anunciado = () =>
        screen
          .getAllByRole('status')
          .map((el) => el.textContent)
          .filter((t) => t.startsWith('Unidades:'));
      expect(anunciado()).toEqual(['Unidades: Apto 101 · Presentes: 1']);

      // Muda o texto SEM mudar a quantidade de participantes: à vista na hora, anunciado depois.
      await user.type(screen.getByLabelText('Unidade do participante 1'), '0');
      expect(
        screen.getByText('Unidades: Apto 1010 · Presentes: 1', { selector: 'p:not([role])' }),
      ).toBeVisible();
      expect(anunciado()).toEqual(['Unidades: Apto 101 · Presentes: 1']);
      await waitFor(() => {
        expect(anunciado()).toEqual(['Unidades: Apto 1010 · Presentes: 1']);
      }, ATE_O_ANUNCIO);

      // Mudar a presença também (a quantidade continua a mesma).
      await user.selectOptions(screen.getByLabelText('Presença de Pessoa 1'), 'ausente');
      await waitFor(() => {
        expect(anunciado()).toEqual(['Unidades: Apto 1010 · Presentes: 0']);
      }, ATE_O_ANUNCIO);

      await user.type(screen.getByLabelText(/^Nome do novo participante/), 'Bia{Enter}');
      await waitFor(() => {
        expect(anunciado()).toEqual(['Unidades: Apto 1010 /  · Presentes: 1']);
      }, ATE_O_ANUNCIO);
    });

    it('tipo sem coluna de papel e sem campo de complemento mantém “Nome — X” no nome', async () => {
      const user = userEvent.setup();
      const semComplemento: AtaTypeDefinition = { ...TIPO_DE_TESTE };
      delete semComplemento.campoComplemento;
      renderizar(<ParticipantesBlock tipo={semComplemento} />);
      // Nada de segundo campo nem de ajuda do formato.
      expect(screen.queryByLabelText(/^Unidade/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Colar lista' }));
      expect(screen.queryByText(/Aceita “Nome/)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
        target: { value: 'Ana Souza — Apto 101' },
      });
      await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
      expect(screen.getByLabelText('Nome do participante 1')).toHaveValue('Ana Souza — Apto 101');
      expect(screen.getByLabelText('Unidade do participante 1')).toHaveValue('');
    });

    it('fala com o substantivo do tipo (“sócio”), no singular e no plural', async () => {
      const user = userEvent.setup();
      const socios: AtaTypeDefinition = {
        ...TIPO_DE_TESTE,
        rotulos: { ...TIPO_DE_TESTE.rotulos, pessoa: { singular: 'sócio', plural: 'sócios' } },
      };
      renderizar(<ParticipantesBlock tipo={socios} />);
      expect(screen.getByText(/^Nenhum sócio ainda\./)).toBeVisible();
      await user.type(screen.getByLabelText(/^Nome do novo sócio/), 'Ana{Enter}');
      expect(screen.getByText('1 sócio adicionado.')).toBeVisible();
      expect(screen.getByText('1 sócio · 1 presente')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Adicionar sócio' })).toBeVisible();
      expect(screen.getByRole('region', { name: 'Lista de sócios' })).toBeVisible();
      expect(screen.getByLabelText('Nome do sócio 1')).toHaveValue('Ana');
      expect(screen.getByLabelText('Unidade do sócio 1')).toBeVisible();
      expect(screen.queryByText(/participante/i)).not.toBeInTheDocument();
    });

    it('complemento que não identifica (ex.: participação): mesmo nome já conta como repetido', async () => {
      const user = userEvent.setup();
      const semIdentificar: AtaTypeDefinition = { ...TIPO_DE_TESTE, complementoIdentifica: false };
      renderizar(<ParticipantesBlock tipo={semIdentificar} />);
      await user.click(screen.getByRole('button', { name: 'Colar lista' }));
      fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
        target: { value: 'Ana Souza — Apto 101' },
      });
      await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
      await user.click(screen.getByRole('button', { name: 'Colar lista' }));
      fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
        target: { value: 'ana souza — Apto 102' },
      });
      await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
      expect(
        screen.getByText(
          '1 participante adicionado · 1 já estava na lista (mantido em duplicidade — remova se não for o caso).',
        ),
      ).toBeVisible();
    });

    it('complemento que identifica (ex.: unidade): mesmo nome em outra unidade não é repetido', async () => {
      const user = userEvent.setup();
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />, membros(1));
      await user.click(screen.getByRole('button', { name: 'Colar lista' }));
      fireEvent.change(screen.getByLabelText(/Nomes, um por linha/), {
        target: { value: 'Pessoa 1 — Apto 999' },
      });
      await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }));
      expect(screen.getByText('1 participante adicionado.')).toBeVisible();
    });

    it('sem alerta, só o texto do resumo fica à vista e é anunciado', () => {
      renderizar(<ParticipantesBlock tipo={TIPO_DE_TESTE} />, membros(3));
      expect(screen.queryByText(/⚠/, { selector: 'p[aria-hidden]' })).not.toBeInTheDocument();
      const anunciados = screen
        .getAllByRole('status')
        .filter((el) => el.textContent.includes('unidades informadas'));
      expect(anunciados.map((el) => el.textContent)).toEqual(['3 unidades informadas']);
    });
  });
});
