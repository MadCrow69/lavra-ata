import { describe, expect, it } from 'vitest';
import { corporativa } from '../ata-types/corporativa';
import type { AtaTypeDefinition } from '../ata-types/types';
import { AVISO_MINUTA, RODAPE_PAGINADO, TEXTO_SECOES_PENDENTES } from '../config/documento';
import {
  ROTULO_PRESENCA,
  ROTULO_STATUS,
  type AtaDraft,
  type Participante,
  type ResultadoAta,
} from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';
import { construirDocumento, contarPreencher, dividirPreencher } from './build-model';
import type { DocBloco, LogoDoc } from './model';

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

function rascunho(parcial: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(),
    dados: {
      organizacao: 'Cooperativa Fictícia',
      assunto: 'Reembolsos',
      data: '2026-10-14',
      inicio: '14:30',
      fim: '16:00',
      modalidade: 'remota',
      local: 'Videoconferência',
      conducao: 'Ana Souza',
      redacao: 'Bruno Lima',
    },
    pauta: ['Reembolsos', 'Orçamento'],
    participantes: [participante(1), participante(2, { presenca: 'ausente' })],
    ...parcial,
  };
}

function resultado(parcial: Partial<ResultadoAta> = {}): ResultadoAta {
  return {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: 'Foi tratado o reembolso.', itens: [] }],
      discussao: [],
      decisoes: [
        { tipo: 'lista', texto: '', itens: ['Aprovar o reembolso', 'Revisar a política'] },
      ],
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
      { acao: 'Rever o fluxo', responsavel: '', prazo: 'próxima reunião', status: 'pendente' },
      { acao: 'Avisar o time', responsavel: 'Bruno Lima', prazo: '', status: 'concluido' },
    ],
    atribuicao: {},
    avisos: {},
    editadas: [],
    ...parcial,
  };
}

type Secao = Extract<DocBloco, { tipo: 'secao' }>;
type Tabela = Extract<DocBloco, { tipo: 'tabela' }>;

function secoes(blocos: DocBloco[]): Secao[] {
  return blocos.filter((b): b is Secao => b.tipo === 'secao');
}

function tabelas(blocos: DocBloco[]): Tabela[] {
  return blocos.flatMap((b) =>
    b.tipo === 'tabela' ? [b] : b.tipo === 'secao' ? tabelas(b.blocos) : [],
  );
}

describe('dividirPreencher', () => {
  it('transforma [PREENCHER: …] em destaque e mantém o texto em volta', () => {
    expect(dividirPreencher('Reunião em [PREENCHER: local] às 14h.')).toEqual([
      { texto: 'Reunião em ' },
      { texto: '[PREENCHER: local]', destaque: 'preencher' },
      { texto: ' às 14h.' },
    ]);
  });

  it('trata vários marcadores, texto sem marcador e texto vazio', () => {
    expect(dividirPreencher('[PREENCHER: a][PREENCHER: b]')).toEqual([
      { texto: '[PREENCHER: a]', destaque: 'preencher' },
      { texto: '[PREENCHER: b]', destaque: 'preencher' },
    ]);
    expect(dividirPreencher('sem lacuna')).toEqual([{ texto: 'sem lacuna' }]);
    expect(dividirPreencher('')).toEqual([]);
  });

  it('não confunde colchetes comuns nem marcador em minúsculas', () => {
    expect(dividirPreencher('Ver [anexo 1] e [preencher: x]')).toEqual([
      { texto: 'Ver [anexo 1] e [preencher: x]' },
    ]);
  });
});

describe('construirDocumento sem resultado (prévia ao vivo)', () => {
  const modelo = construirDocumento(rascunho(), corporativa);

  it('traz título e cabeçalho com os dados já digitados', () => {
    expect(modelo.titulo).toBe('Ata de reunião — Reembolsos');
    expect(modelo.cabecalho.logo).toBeNull();
    expect(modelo.cabecalho.linhas).toEqual([
      'Cooperativa Fictícia',
      'Data: 14/10/2026',
      'Horário: 14h30 às 16h',
      'Modalidade: Remota',
      'Plataforma: Videoconferência',
    ]);
  });

  it('lista os participantes em tabela com a presença por extenso', () => {
    const [tabela] = tabelas(modelo.blocos);
    expect(tabela?.colunas).toEqual(['Nome', 'Cargo / empresa', 'Presença']);
    expect(tabela?.linhas).toEqual([
      ['Pessoa 1', 'Cargo 1', ROTULO_PRESENCA.presente],
      ['Pessoa 2', 'Cargo 2', ROTULO_PRESENCA.ausente],
    ]);
    expect(tabela?.colunaPresenca).toBe(2);
    expect(tabela?.presencas).toEqual(['presente', 'ausente']);
  });

  it('mostra a pauta como lista', () => {
    const lista = modelo.blocos.find((b) => b.tipo === 'lista');
    expect(lista).toEqual({
      tipo: 'lista',
      itens: [[{ texto: 'Reembolsos' }], [{ texto: 'Orçamento' }]],
    });
  });

  it('deixa um único placeholder no lugar das seções e omite preâmbulo, fecho e aviso', () => {
    const [placeholder, ...outras] = secoes(modelo.blocos);
    expect(outras).toEqual([]);
    expect(placeholder?.gerada).toBe(false);
    expect(placeholder?.blocos).toEqual([
      { tipo: 'paragrafo', partes: [{ texto: TEXTO_SECOES_PENDENTES }] },
    ]);
    expect(modelo.blocos.some((b) => b.tipo === 'aviso' || b.tipo === 'assinaturas')).toBe(false);
    expect(JSON.stringify(modelo.blocos)).not.toContain('lavrada');
  });

  it('não inventa lacunas para o que ainda não foi digitado', () => {
    const vazio = construirDocumento(criarRascunho(), corporativa);
    expect(vazio.titulo).toBe('Ata de reunião');
    expect(vazio.cabecalho.linhas).toEqual([]);
    expect(contarPreencher(vazio)).toBe(0);
    expect(tabelas(vazio.blocos)).toEqual([]);
  });

  it('imprime a justificativa só de quem está justificado, ignorando texto antigo', () => {
    const d = rascunho({
      participantes: [
        participante(1, { presenca: 'presente', justificativa: 'texto que sobrou' }),
        participante(2, { presenca: 'justificado', justificativa: 'Consulta médica' }),
        participante(3, { presenca: 'justificado', justificativa: '' }),
      ],
    });
    const [tabela] = tabelas(construirDocumento(d, corporativa).blocos);
    expect(tabela?.linhas.map((l) => l[2])).toEqual([
      ROTULO_PRESENCA.presente,
      `${ROTULO_PRESENCA.justificado}: Consulta médica`,
      ROTULO_PRESENCA.justificado,
    ]);
  });

  it('usa um traço para nome ou cargo em branco', () => {
    const d = rascunho({ participantes: [participante(1, { nome: ' ', papel: '' })] });
    const [tabela] = tabelas(construirDocumento(d, corporativa).blocos);
    expect(tabela?.linhas).toEqual([['—', '—', ROTULO_PRESENCA.presente]]);
  });

  it('pede o cabeçalho ao tipo, sem depender dos campos do corporativo', () => {
    const outro: AtaTypeDefinition = { ...corporativa, cabecalho: () => ['Linha do outro tipo'] };
    expect(construirDocumento(rascunho(), outro).cabecalho.linhas).toEqual(['Linha do outro tipo']);
  });

  it('transforma 200 participantes em 200 linhas', () => {
    const d = rascunho({
      participantes: Array.from({ length: 200 }, (_, i) => participante(i + 1)),
    });
    const [tabela] = tabelas(construirDocumento(d, corporativa).blocos);
    expect(tabela?.linhas).toHaveLength(200);
    expect(tabela?.linhas[199]?.[0]).toBe('Pessoa 200');
  });

  it('acrescenta uma coluna por campo extra do participante', () => {
    const tipo: AtaTypeDefinition = {
      ...corporativa,
      camposParticipante: [
        {
          id: 'condicao',
          rotulo: 'Condição',
          tipo: 'escolha',
          obrigatorio: false,
          opcoes: [{ valor: 'titular', rotulo: 'Titular' }],
        },
        { id: 'unidade', rotulo: 'Unidade', tipo: 'texto', obrigatorio: false },
      ],
    };
    const d = rascunho({ participantes: [participante(1, { extras: { condicao: 'titular' } })] });
    const [tabela] = tabelas(construirDocumento(d, tipo).blocos);
    expect(tabela?.colunas).toEqual(['Nome', 'Cargo / empresa', 'Condição', 'Unidade', 'Presença']);
    expect(tabela?.linhas[0]).toEqual([
      'Pessoa 1',
      'Cargo 1',
      'Titular',
      '—',
      ROTULO_PRESENCA.presente,
    ]);
    expect(tabela?.colunaPresenca).toBe(4);
  });
});

describe('construirDocumento com logo', () => {
  const logo: LogoDoc = { dataUrl: 'data:image/png;base64,AAAA', largura: 300, altura: 100 };

  it('põe a logo em cabecalho.logo', () => {
    expect(construirDocumento(rascunho(), corporativa, logo).cabecalho.logo).toEqual(logo);
  });

  it('sem o terceiro argumento, ou com null, a logo é null', () => {
    expect(construirDocumento(rascunho(), corporativa).cabecalho.logo).toBeNull();
    expect(construirDocumento(rascunho(), corporativa, null).cabecalho.logo).toBeNull();
  });

  it('a logo não muda o resto do documento', () => {
    const com = construirDocumento(rascunho(), corporativa, logo);
    const sem = construirDocumento(rascunho(), corporativa);
    expect({ ...com, cabecalho: { ...com.cabecalho, logo: null } }).toEqual(sem);
  });
});

describe('construirDocumento com resultado', () => {
  const d = rascunho({ resultado: resultado() });
  const modelo = construirDocumento(d, corporativa);

  it('abre com o preâmbulo do tipo, antes da lista de participantes', () => {
    const [primeiro] = modelo.blocos;
    expect(primeiro?.tipo).toBe('paragrafo');
    expect(JSON.stringify(primeiro)).toContain('Aos catorze dias do mês de outubro');
  });

  it('põe as seções na ordem do tipo e omite as vazias', () => {
    expect(secoes(modelo.blocos).map((s) => s.chave)).toEqual([
      'resumo',
      'decisoes',
      'encaminhamentos',
    ]);
    expect(secoes(modelo.blocos).every((s) => s.gerada)).toBe(true);
    const decisoes = secoes(modelo.blocos).find((s) => s.chave === 'decisoes');
    expect(decisoes?.titulo).toBe('Decisões');
    expect(decisoes?.blocos).toEqual([
      {
        tipo: 'lista',
        itens: [[{ texto: 'Aprovar o reembolso' }], [{ texto: 'Revisar a política' }]],
      },
    ]);
  });

  it('não mostra o placeholder depois de gerar', () => {
    expect(JSON.stringify(modelo.blocos)).not.toContain(TEXTO_SECOES_PENDENTES);
  });

  it('monta a tabela de encaminhamentos com data dd/mm/aaaa e texto livre mantido', () => {
    const enc = secoes(modelo.blocos).find((s) => s.chave === 'encaminhamentos');
    const [tabela] = tabelas(enc?.blocos ?? []);
    expect(tabela?.colunas).toEqual(['Ação', 'Responsável', 'Prazo', 'Status']);
    expect(tabela?.larguras).toEqual([50, 20, 15, 15]);
    expect(tabela?.linhas).toEqual([
      ['Enviar a planilha', 'Ana Souza', '30/10/2026', ROTULO_STATUS.em_andamento],
      ['Rever o fluxo', 'A definir', 'próxima reunião', ROTULO_STATUS.pendente],
      ['Avisar o time', 'Bruno Lima', '—', ROTULO_STATUS.concluido],
    ]);
  });

  it('mantém como texto o prazo que só parece uma data', () => {
    const r = resultado({
      encaminhamentos: [
        { acao: 'A', responsavel: 'B', prazo: '2026-02-30', status: 'pendente' },
        { acao: 'C', responsavel: 'D', prazo: '30/10/2026', status: 'pendente' },
      ],
    });
    const enc = secoes(construirDocumento(rascunho({ resultado: r }), corporativa).blocos).find(
      (s) => s.chave === 'encaminhamentos',
    );
    const [tabela] = tabelas(enc?.blocos ?? []);
    expect(tabela?.linhas.map((l) => l[2])).toEqual(['2026-02-30', '30/10/2026']);
  });

  it('omite a seção de encaminhamentos quando não há nenhum', () => {
    const sem = construirDocumento(
      rascunho({ resultado: resultado({ encaminhamentos: [] }) }),
      corporativa,
    );
    expect(secoes(sem.blocos).map((s) => s.chave)).not.toContain('encaminhamentos');
  });

  it('fecha com o fecho, as assinaturas e o aviso de minuta, nessa ordem', () => {
    const fim = modelo.blocos.slice(-3);
    expect(JSON.stringify(fim[0])).toContain('foi lavrada a presente ata');
    expect(fim[1]).toEqual({
      tipo: 'assinaturas',
      pessoas: [
        { nome: 'Ana Souza', papel: 'Condução' },
        { nome: 'Bruno Lima', papel: 'Redação' },
      ],
    });
    expect(fim[2]).toEqual({ tipo: 'aviso', texto: AVISO_MINUTA });
  });

  it('omite as assinaturas quando o tipo não devolve ninguém', () => {
    const sem = construirDocumento(
      rascunho({
        resultado: resultado(),
        dados: { ...rascunho().dados, conducao: '', redacao: '' },
      }),
      corporativa,
    );
    expect(sem.blocos.some((b) => b.tipo === 'assinaturas')).toBe(false);
    expect(sem.blocos.at(-1)).toEqual({ tipo: 'aviso', texto: AVISO_MINUTA });
  });

  it('marca [PREENCHER: …] dos blocos como destaque e conta as lacunas', () => {
    const r = resultado({
      secoes: {
        ...resultado().secoes,
        resumo: [
          { tipo: 'paragrafo', texto: 'Reunião em [PREENCHER: local] hoje.', itens: [] },
          { tipo: 'lista', texto: 'Itens:', itens: ['Valor: [PREENCHER: valor]'] },
        ],
      },
    });
    const com = construirDocumento(rascunho({ resultado: r }), corporativa);
    const resumo = secoes(com.blocos).find((s) => s.chave === 'resumo');
    expect(resumo?.blocos).toEqual([
      {
        tipo: 'paragrafo',
        partes: [
          { texto: 'Reunião em ' },
          { texto: '[PREENCHER: local]', destaque: 'preencher' },
          { texto: ' hoje.' },
        ],
      },
      { tipo: 'paragrafo', partes: [{ texto: 'Itens:' }] },
      {
        tipo: 'lista',
        itens: [[{ texto: 'Valor: ' }, { texto: '[PREENCHER: valor]', destaque: 'preencher' }]],
      },
    ]);
    expect(contarPreencher(com)).toBe(2);
  });

  it('conta também as lacunas do preâmbulo e das células de tabela', () => {
    const r = resultado({
      encaminhamentos: [
        { acao: 'Pagar [PREENCHER: valor]', responsavel: 'Ana', prazo: '', status: 'pendente' },
      ],
    });
    const faltando = construirDocumento(
      rascunho({ resultado: r, dados: { organizacao: 'Cooperativa Fictícia' } }),
      corporativa,
    );
    // Preâmbulo: data, hora, modalidade, assunto; tabela: valor.
    expect(contarPreencher(faltando)).toBe(5);
  });

  it('rodapé interno lista os provedores das seções na folha, sem repetir (spec 8.1.1)', () => {
    const gemini = { provedor: 'gemini' as const, modelo: 'gemini-3.8-flash', falhas: [] };
    const openai = { provedor: 'openai' as const, modelo: 'gpt-6-luna', falhas: [] };
    const doc = construirDocumento(
      rascunho({
        resultado: resultado({
          atribuicao: {
            resumo: gemini,
            decisoes: openai,
            encaminhamentos: gemini,
            // Seção vazia não aparece na folha: o provedor dela não conta.
            riscos: { provedor: 'anthropic', modelo: 'claude-haiku-5-5', falhas: [] },
          },
        }),
      }),
      corporativa,
    );
    expect(doc.rodapeInterno).toBe(
      'Minuta gerada com auxílio de IA (Gemini · gemini-3.8-flash, OpenAI · gpt-6-luna).',
    );
    // O rodapé paginado do PDF/DOCX não muda.
    expect(doc.rodape).toBe(RODAPE_PAGINADO);
  });

  it('sem atribuição (antes de gerar ou só texto escrito à mão), não há rodapé interno', () => {
    expect(construirDocumento(rascunho(), corporativa).rodapeInterno).toBeNull();
    expect(
      construirDocumento(rascunho({ resultado: resultado() }), corporativa).rodapeInterno,
    ).toBeNull();
  });

  it('não altera o rascunho', () => {
    const antes = JSON.stringify(d);
    construirDocumento(d, corporativa);
    expect(JSON.stringify(d)).toBe(antes);
  });
});
