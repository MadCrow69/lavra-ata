import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AVISO_MINUTA, TEXTO_SECOES_PENDENTES } from '../../config/documento';
import { DraftProvider } from '../../domain/DraftContext';
import {
  ROTULO_PRESENCA,
  ROTULO_STATUS,
  type AtaDraft,
  type Participante,
  type ResultadoAta,
} from '../../domain/draft';
import { CHAVE_AVISOS_GERAIS, criarRascunho } from '../../domain/draft-reducer';
import { A4Preview } from './A4Preview';

function participante(i: number, parcial: Partial<Participante> = {}): Participante {
  return {
    id: `p${String(i)}`,
    nome: `Pessoa ${String(i)}`,
    papel: `Cargo ${String(i)}`,
    presenca: 'presente',
    justificativa: '',
    extras: {},
    ...parcial,
  };
}

function resultado(parcial: Partial<ResultadoAta> = {}): ResultadoAta {
  return {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: 'Foi tratado o reembolso.', itens: [] }],
      discussao: [],
      decisoes: [{ tipo: 'lista', texto: '', itens: ['Aprovar o reembolso'] }],
      pendencias: [],
      riscos: [],
      proxima_reuniao: [],
    },
    encaminhamentos: [
      {
        acao: 'Enviar a planilha',
        responsavel: 'Ana Souza',
        prazo: '2026-10-30',
        status: 'em_andamento',
      },
    ],
    atribuicao: {},
    avisos: {},
    editadas: [],
    ...parcial,
  };
}

function rascunho(parcial: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(),
    dados: {
      organizacao: 'Cooperativa Fictícia',
      assunto: 'Reembolsos',
      data: '2026-10-14',
      inicio: '14:30',
      modalidade: 'remota',
      local: 'Videoconferência',
      conducao: 'Ana Souza',
    },
    pauta: ['Reembolsos'],
    participantes: [
      participante(1),
      participante(2, { presenca: 'ausente' }),
      participante(3, { presenca: 'justificado', justificativa: 'Consulta médica' }),
    ],
    ...parcial,
  };
}

function renderizar(inicial: AtaDraft) {
  return render(
    <DraftProvider inicial={inicial}>
      <A4Preview />
    </DraftProvider>,
  );
}

describe('A4Preview antes de gerar', () => {
  it('mostra título, cabeçalho, participantes, pauta e o placeholder das seções', () => {
    renderizar(rascunho());
    expect(
      screen.getByRole('heading', { name: 'Ata de reunião — Reembolsos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cooperativa Fictícia')).toBeInTheDocument();
    expect(screen.getByText('Data: 14/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Horário: 14h30')).toBeInTheDocument();
    expect(screen.getByText('Plataforma: Videoconferência')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Participantes' })).toBeInTheDocument();
    expect(screen.getByText('Reembolsos', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(TEXTO_SECOES_PENDENTES)).toBeInTheDocument();
    expect(screen.getByText('Sua logo')).toBeInTheDocument();
  });

  it('mostra a presença com texto, além do ícone', () => {
    renderizar(rascunho());
    const tabela = screen.getByRole('table', { name: 'Participantes' });
    expect(
      within(within(tabela).getByRole('row', { name: /Pessoa 1/ })).getByText(
        ROTULO_PRESENCA.presente,
      ),
    ).toBeVisible();
    expect(
      within(within(tabela).getByRole('row', { name: /Pessoa 2/ })).getByText(
        ROTULO_PRESENCA.ausente,
      ),
    ).toBeVisible();
    expect(
      within(within(tabela).getByRole('row', { name: /Pessoa 3/ })).getByText(
        ROTULO_PRESENCA.justificado,
      ),
    ).toBeVisible();
    // O ícone é decorativo: o texto é quem informa.
    expect(tabela.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
  });

  it('imprime a justificativa só de quem está justificado', () => {
    renderizar(
      rascunho({
        participantes: [
          participante(1, { presenca: 'presente', justificativa: 'texto que sobrou' }),
          participante(2, { presenca: 'justificado', justificativa: 'Consulta médica' }),
        ],
      }),
    );
    expect(screen.getByText(/Consulta médica/)).toBeInTheDocument();
    expect(screen.queryByText(/texto que sobrou/)).not.toBeInTheDocument();
  });

  it('não mostra contador nem aviso de minuta', () => {
    renderizar(rascunho());
    expect(screen.queryByRole('button', { name: /para preencher/ })).not.toBeInTheDocument();
    expect(screen.queryByText(AVISO_MINUTA)).not.toBeInTheDocument();
  });

  it('desenha 200 participantes em 200 linhas', () => {
    renderizar(
      rascunho({ participantes: Array.from({ length: 200 }, (_, i) => participante(i + 1)) }),
    );
    const tabela = screen.getByRole('table', { name: 'Participantes' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(201);
    expect(within(tabela).getByText('Pessoa 200')).toBeInTheDocument();
  });
});

describe('A4Preview depois de gerar', () => {
  it('mostra seções, encaminhamentos, fecho, assinaturas e aviso de minuta', () => {
    renderizar(rascunho({ resultado: resultado() }));
    expect(screen.getByText(/Aos catorze dias do mês de outubro/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumo' })).toBeInTheDocument();
    expect(screen.getByText('Foi tratado o reembolso.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Decisões' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Riscos' })).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTO_SECOES_PENDENTES)).not.toBeInTheDocument();
    expect(screen.getByText(/foi lavrada a presente ata/)).toBeInTheDocument();
    expect(screen.getByText(AVISO_MINUTA)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Assinaturas' })).toBeInTheDocument();
  });

  it('desenha a tabela de encaminhamentos com data dd/mm/aaaa e status em português', () => {
    renderizar(rascunho({ resultado: resultado() }));
    const tabela = screen.getByRole('table', { name: 'Encaminhamentos' });
    expect(
      within(tabela)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Ação', 'Responsável', 'Prazo', 'Status']);
    expect(within(tabela).getByText('30/10/2026')).toBeInTheDocument();
    expect(within(tabela).getByText(ROTULO_STATUS.em_andamento)).toBeInTheDocument();
    const colunas = tabela.querySelectorAll('col');
    expect(colunas[0]).toHaveStyle({ width: '50%' });
  });

  it('dá a cada seção um contêiner estável, com id e data-secao', () => {
    const { container } = renderizar(rascunho({ resultado: resultado() }));
    const resumo = container.querySelector('[data-secao="resumo"]');
    expect(resumo).toBeInstanceOf(HTMLElement);
    expect(resumo?.id).toBe('ata-secao-resumo');
    expect(resumo?.getAttribute('aria-labelledby')).toBe('ata-secao-resumo-titulo');
    expect(container.querySelector('[data-secao="encaminhamentos"]')).not.toBeNull();
  });

  it('mostra os avisos gerais acima da folha, fora do documento', () => {
    const { container } = renderizar(
      rascunho({
        resultado: resultado({
          avisos: {
            [CHAVE_AVISOS_GERAIS]: ['Seu texto já tinha um trecho parecido com um marcador.'],
          },
        }),
      }),
    );
    const aviso = screen.getByText('Seu texto já tinha um trecho parecido com um marcador.');
    const folha = container.querySelector('[data-folha]');
    expect(folha).not.toBeNull();
    expect(folha?.contains(aviso)).toBe(false);
    expect(
      aviso.compareDocumentPosition(folha as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('A4Preview contador de campos para preencher', () => {
  const comLacunas = rascunho({
    resultado: resultado({
      secoes: {
        ...resultado().secoes,
        resumo: [
          {
            tipo: 'paragrafo',
            texto: 'Reunião em [PREENCHER: local] com [PREENCHER: valor].',
            itens: [],
          },
        ],
      },
    }),
  });

  it('mostra a quantidade, no plural', () => {
    renderizar(comLacunas);
    expect(screen.getByRole('button', { name: '2 campos para preencher' })).toBeInTheDocument();
  });

  it('usa o singular para uma lacuna', () => {
    renderizar(
      rascunho({
        resultado: resultado({
          secoes: {
            ...resultado().secoes,
            resumo: [{ tipo: 'paragrafo', texto: 'Em [PREENCHER: local].', itens: [] }],
          },
        }),
      }),
    );
    expect(screen.getByRole('button', { name: '1 campo para preencher' })).toBeInTheDocument();
  });

  it('some quando não há lacunas', () => {
    renderizar(rascunho({ resultado: resultado() }));
    expect(screen.queryByRole('button', { name: /para preencher/ })).not.toBeInTheDocument();
  });

  it('torna cada lacuna um alvo focável com nome acessível', () => {
    renderizar(comLacunas);
    const alvo = screen.getByLabelText('Campo para preencher: local');
    expect(alvo).toHaveTextContent('[PREENCHER: local]');
    expect(alvo).toHaveAttribute('tabindex', '0');
    expect(screen.getByLabelText('Campo para preencher: valor')).toBeInTheDocument();
  });

  it('leva o foco à primeira lacuna e depois à seguinte', async () => {
    const usuario = userEvent.setup();
    renderizar(comLacunas);
    const botao = screen.getByRole('button', { name: '2 campos para preencher' });
    await usuario.click(botao);
    expect(screen.getByLabelText('Campo para preencher: local')).toHaveFocus();
    await usuario.click(botao);
    expect(screen.getByLabelText('Campo para preencher: valor')).toHaveFocus();
    await usuario.click(botao);
    expect(screen.getByLabelText('Campo para preencher: local')).toHaveFocus();
  });

  it('conta as lacunas do preâmbulo quando faltam dados do formulário', () => {
    renderizar(
      rascunho({ dados: { organizacao: 'Cooperativa Fictícia' }, resultado: resultado() }),
    );
    // data, horário, modalidade e assunto
    expect(screen.getByRole('button', { name: '4 campos para preencher' })).toBeInTheDocument();
  });
});
