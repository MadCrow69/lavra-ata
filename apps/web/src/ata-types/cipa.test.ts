import { describe, expect, it } from 'vitest';
import { AVISO_MINUTA } from '../config/documento';
import { construirDocumento, textosDoDocumento } from '../document/build-model';
import type { DocBloco } from '../document/model';
import type { AtaDraft, Participante, ResultadoAta } from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';
import { montarPrompt } from '../generation/prompt';
import { cipa } from './cipa';
import { presentes } from './comum-formal';
import { ATA_TYPES, camposFaltando, obterTipo } from './registry';

type Dados = Record<string, string>;

const DADOS_COMPLETOS: Dados = {
  empresa: 'Empresa Exemplo Ltda.',
  estabelecimento: 'Unidade Centro',
  gestao: '2026/2027',
  numero: '3',
  natureza: 'ordinaria',
  data: '2026-10-14',
  inicio: '14:30',
  fim: '16:00',
  modalidade: 'presencial',
  local: 'Sala de Treinamento 2',
  presidente: 'Carla Mendes',
  secretario: 'Diego Faria',
};

function pessoa(
  id: string,
  nome: string,
  extras: Dados,
  parcial: Partial<Participante> = {},
): Participante {
  return {
    id,
    nome,
    papel: 'Analista',
    presenca: 'presente',
    justificativa: '',
    extras,
    ...parcial,
  };
}

/** 4 membros (um com ausência justificada) e 1 convidado presente: 4 presentes. */
const PARTICIPANTES: Participante[] = [
  pessoa('m1', 'Carla Mendes', { representacao: 'organizacao', condicao: 'titular' }),
  pessoa('m2', 'Diego Faria', { representacao: 'empregados', condicao: 'titular' }),
  pessoa('m3', 'Elisa Prado', { representacao: 'empregados', condicao: 'suplente' }),
  pessoa(
    'm4',
    'Fábio Ramos',
    { representacao: 'organizacao', condicao: 'suplente' },
    { presenca: 'justificado', justificativa: 'Férias' },
  ),
  pessoa('c1', 'Gisele Torres', { representacao: 'convidado' }, { papel: 'Técnica de segurança' }),
];

const par = (texto: string) => ({ tipo: 'paragrafo' as const, texto, itens: [] });

const RESULTADO: ResultadoAta = {
  secoes: Object.fromEntries(cipa.secoes.map((s) => [s.chave, [par(`Texto de ${s.titulo}.`)]])),
  encaminhamentos: [
    { acao: 'Revisar o mapa de riscos', responsavel: 'Elisa Prado', prazo: '', status: 'pendente' },
  ],
  atribuicao: {},
  avisos: {},
  editadas: [],
};

function rascunho(dados: Dados = {}, sobrescrever: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(cipa.id),
    dados: { ...DADOS_COMPLETOS, ...dados },
    pauta: ['Análise do acidente na expedição', 'Plano de trabalho'],
    participantes: PARTICIPANTES,
    transcricao: 'Carla: bom dia a todos.',
    resultado: RESULTADO,
    ...sobrescrever,
  };
}

const completo = () => rascunho();
const porAcidente = () =>
  rascunho({
    natureza: 'extraordinaria',
    motivo: 'acidente',
    motivo_detalhe: 'queda na expedição em 10/10/2026',
  });
const porSolicitacao = () =>
  rascunho({ natureza: 'extraordinaria', motivo: 'solicitacao', numero: '' });
const hibrida = () => rascunho({ modalidade: 'hibrida', plataforma: 'Sala virtual da empresa' });

const faltas = (d: AtaDraft) => camposFaltando(d, cipa).map((f) => f.rotulo);

describe('CIPA: registro', () => {
  it('está registrada pelo id, com rótulos próprios', () => {
    expect(ATA_TYPES.cipa).toBe(cipa);
    expect(obterTipo('cipa')).toBe(cipa);
    expect(cipa.rotulo).toBe('CIPA — reunião ordinária ou extraordinária');
    expect(cipa.descricao).toBe('Comissão Interna de Prevenção de Acidentes e de Assédio (NR-5).');
    expect(cipa.rotulos).toEqual({ participantes: 'Participantes', pauta: 'Pauta' });
    expect(cipa.rotuloPapel).toBe('Cargo / função');
    expect(cipa.temEncaminhamentos).toBe(true);
    expect(cipa.camposNoPrompt).toEqual([
      'data',
      'natureza',
      'motivo',
      'modalidade',
      'presidente',
      'secretario',
    ]);
    expect(Object.keys(cipa.textosFixos ?? {}).sort()).toEqual(
      [
        'nomeComissao',
        'secretarioDesignado',
        'motivoAcidente',
        'motivoSolicitacao',
        'localNaOrganizacao',
        'participacaoRemota',
        'fechoPresentes',
        'avisoDisponibilizacao',
      ].sort(),
    );
  });

  it('seções na ordem do documento', () => {
    expect(cipa.secoes.map((s) => [s.chave, s.titulo])).toEqual([
      ['abertura', 'Abertura'],
      ['ata_anterior', 'Leitura da ata anterior'],
      ['pendencias_anteriores', 'Acompanhamento das pendências anteriores'],
      ['discussao', 'Assuntos tratados'],
      ['deliberacoes', 'Deliberações'],
      ['encerramento', 'Encerramento'],
    ]);
  });
});

describe('CIPA: campos', () => {
  it('rascunho completo não tem faltas', () => {
    expect(faltas(completo())).toEqual([]);
    expect(faltas(porAcidente())).toEqual([]);
    expect(faltas(hibrida())).toEqual([]);
  });

  it('obrigatórios do tipo em rascunho vazio', () => {
    expect(faltas({ ...criarRascunho(cipa.id), participantes: PARTICIPANTES })).toEqual([
      'Empresa',
      'Gestão (mandato)',
      'Natureza',
      'Data',
      'Início',
      'Modalidade',
      'Local',
      'Presidente',
      'Secretário(a) designado(a)',
      'Pauta',
      'Transcrição',
    ]);
  });

  it('extraordinária sem motivo → falta "Motivo da reunião extraordinária"', () => {
    const d = rascunho({ natureza: 'extraordinaria' });
    expect(faltas(d)).toEqual(['Motivo da reunião extraordinária']);
    const campo = cipa.campos.find((c) => c.id === 'motivo');
    expect(campo?.erroObrigatorio).toBe('Informe o motivo da reunião extraordinária.');
    expect(campo?.ajuda).toBe('NR-5, item 5.6.4.');
  });

  it('ordinária → motivo e detalhe invisíveis e sem falta, mesmo com valor antigo', () => {
    const d = rascunho({ natureza: 'ordinaria', motivo: 'valor-antigo' });
    expect(faltas(d)).toEqual([]);
    const visiveis = cipa.campos
      .filter((c) => (c.visivelSe ? c.visivelSe(d.dados) : true))
      .map((c) => c.id);
    expect(visiveis).not.toContain('motivo');
    expect(visiveis).not.toContain('motivo_detalhe');
  });

  it('modalidade "remota" (vinda da corporativa) → "Modalidade (corrigir)"', () => {
    expect(faltas(rascunho({ modalidade: 'remota' }))).toEqual(['Modalidade (corrigir)']);
  });

  it('plataforma só aparece na participação remota e é opcional', () => {
    const plataforma = cipa.campos.find((c) => c.id === 'plataforma');
    expect(plataforma?.visivelSe?.({ modalidade: 'hibrida' })).toBe(true);
    expect(plataforma?.visivelSe?.({ modalidade: 'presencial' })).toBe(false);
    expect(faltas(rascunho({ modalidade: 'hibrida' }))).toEqual([]);
  });

  it('número da reunião: inteiro de 1 a 999, com teclado numérico', () => {
    const numero = cipa.campos.find((c) => c.id === 'numero');
    expect(numero?.teclado).toBe('numeric');
    for (const ok of ['1', '3', '999', ' 12 ']) {
      expect(numero?.validar?.(ok.trim(), {})).toBeNull();
    }
    for (const ruim of ['0', '1000', '3ª', '-2', '2,5', 'três']) {
      expect(numero?.validar?.(ruim, {})).toBe('Use só o número da reunião (ex.: 3).');
    }
    expect(faltas(rascunho({ numero: '3ª' }))).toEqual(['Número da reunião (corrigir)']);
  });

  it('representação é obrigatória; condição é opcional (convidado não trava)', () => {
    const semRepresentacao = rascunho(
      {},
      { participantes: [pessoa('x', 'Hugo Lins', { condicao: 'titular' })] },
    );
    expect(faltas(semRepresentacao)).toEqual(['Representação']);
    const convidado = rascunho(
      {},
      { participantes: [pessoa('x', 'Hugo Lins', { representacao: 'convidado' })] },
    );
    expect(faltas(convidado)).toEqual([]);
  });
});

describe('CIPA: título', () => {
  it('com número, natureza e empresa', () => {
    expect(cipa.titulo(DADOS_COMPLETOS)).toBe(
      'Ata da 3ª Reunião Ordinária da CIPA — Empresa Exemplo Ltda.',
    );
    expect(cipa.titulo({ ...DADOS_COMPLETOS, natureza: 'extraordinaria', numero: '12' })).toBe(
      'Ata da 12ª Reunião Extraordinária da CIPA — Empresa Exemplo Ltda.',
    );
  });

  it('sem número, sem natureza ou sem empresa', () => {
    expect(cipa.titulo({ ...DADOS_COMPLETOS, numero: '' })).toBe(
      'Ata de Reunião Ordinária da CIPA — Empresa Exemplo Ltda.',
    );
    expect(cipa.titulo({ ...DADOS_COMPLETOS, numero: 'abc' })).toBe(
      'Ata de Reunião Ordinária da CIPA — Empresa Exemplo Ltda.',
    );
    expect(cipa.titulo({})).toBe('Ata de Reunião da CIPA');
    expect(cipa.titulo({ empresa: '  ', natureza: 'ordinaria' })).toBe(
      'Ata de Reunião Ordinária da CIPA',
    );
  });
});

describe('CIPA: preâmbulo', () => {
  it('caso completo, presencial', () => {
    expect(cipa.preambulo(completo())).toBe(
      'Aos catorze dias do mês de outubro de dois mil e vinte e seis, às 14h30, nas dependências da organização, em Sala de Treinamento 2, realizou-se a 3ª reunião ordinária da Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA) de Empresa Exemplo Ltda., estabelecimento Unidade Centro, gestão 2026/2027, presidida por Carla Mendes e secretariada por Diego Faria, designado(a) pelos membros para redigir esta ata. A presença dos membros e convidados está registrada a seguir.',
    );
  });

  it('extraordinária por acidente, com detalhe', () => {
    expect(cipa.preambulo(porAcidente())).toBe(
      'Aos catorze dias do mês de outubro de dois mil e vinte e seis, às 14h30, em Sala de Treinamento 2, realizou-se a 3ª reunião extraordinária da Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA) de Empresa Exemplo Ltda., estabelecimento Unidade Centro, gestão 2026/2027, convocada em razão de acidente do trabalho grave ou fatal: queda na expedição em 10/10/2026, presidida por Carla Mendes e secretariada por Diego Faria, designado(a) pelos membros para redigir esta ata. A presença dos membros e convidados está registrada a seguir.',
    );
  });

  it('extraordinária por solicitação, sem número e sem detalhe', () => {
    const texto = cipa.preambulo(porSolicitacao());
    expect(texto).toContain(
      'realizou-se reunião extraordinária da Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA)',
    );
    expect(texto).toContain(
      'gestão 2026/2027, convocada em razão de solicitação de uma das representações, presidida por',
    );
  });

  it('híbrida: participação remota com e sem plataforma', () => {
    expect(cipa.preambulo(hibrida())).toContain(
      'nas dependências da organização, em Sala de Treinamento 2, com participação remota por meio de Sala virtual da empresa, realizou-se',
    );
    expect(cipa.preambulo(rascunho({ modalidade: 'hibrida' }))).toContain(
      'em Sala de Treinamento 2, com participação remota, realizou-se',
    );
  });

  it('"nas dependências da organização" só na ordinária (NR-5, 5.6.2)', () => {
    const local = cipa.textosFixos?.localNaOrganizacao ?? '?';
    expect(cipa.preambulo(completo())).toContain(`às 14h30, ${local}, em Sala de Treinamento 2`);
    for (const d of [porAcidente(), porSolicitacao(), rascunho({ natureza: '' })]) {
      const texto = cipa.preambulo(d);
      expect(texto).not.toContain(local);
      expect(texto).toContain('às 14h30, em Sala de Treinamento 2');
    }
  });

  it('extraordinária → ordinária com o motivo ainda nos dados: o motivo some', () => {
    const d = rascunho({ natureza: 'ordinaria', motivo: 'acidente', motivo_detalhe: 'queda' });
    const texto = cipa.preambulo(d);
    expect(texto).not.toContain('convocada em razão');
    expect(texto).not.toContain('queda');
    const { usuario } = montarPrompt(cipa, d, d.transcricao);
    expect(usuario).not.toContain('Motivo da reunião extraordinária');
    expect(usuario).not.toContain('Acidente do trabalho');
    const extra = rascunho({ natureza: 'extraordinaria', motivo: 'acidente' });
    expect(montarPrompt(cipa, extra, extra.transcricao).usuario).toContain(
      'Motivo da reunião extraordinária: Acidente do trabalho grave ou fatal',
    );
  });

  it('dados ausentes viram [PREENCHER: …] e nunca lançam', () => {
    const texto = cipa.preambulo({
      ...criarRascunho(cipa.id),
      dados: { natureza: 'extraordinaria' },
    });
    for (const lacuna of [
      'data da reunião',
      'horário de início',
      'local',
      'empresa',
      'gestão',
      'motivo da reunião extraordinária',
      'presidente',
      'secretário(a)',
    ]) {
      expect(texto).toContain(`[PREENCHER: ${lacuna}]`);
    }
    expect(cipa.preambulo({ ...criarRascunho(cipa.id), dados: {} })).toContain(
      '[PREENCHER: natureza da reunião]',
    );
  });
});

describe('CIPA: cabeçalho, fecho e assinaturas', () => {
  it('cabeçalho com empresa, estabelecimento, gestão e dados da reunião', () => {
    expect(cipa.cabecalho(hibrida())).toEqual([
      'Empresa Exemplo Ltda.',
      'Estabelecimento: Unidade Centro',
      'Gestão: 2026/2027',
      'Data: 14/10/2026',
      'Horário: 14h30 às 16h',
      'Modalidade: Presencial, com participação remota',
      'Local: Sala de Treinamento 2',
      'Plataforma da participação remota: Sala virtual da empresa',
    ]);
    expect(cipa.cabecalho(criarRascunho(cipa.id))).toEqual([]);
  });

  it('fecho com o secretário designado e o horário de término', () => {
    expect(cipa.fecho(completo())).toBe(
      'Nada mais havendo a tratar, a reunião foi encerrada às 16h. E, para constar, eu, Diego Faria, secretário(a) designado(a), lavrei a presente ata, que vai assinada pelos presentes.',
    );
    expect(cipa.fecho(rascunho({ fim: '', secretario: '' }))).toBe(
      'Nada mais havendo a tratar, a reunião foi encerrada. E, para constar, eu, [PREENCHER: secretário(a)], secretário(a) designado(a), lavrei a presente ata, que vai assinada pelos presentes.',
    );
  });

  it('assinaturas: um grupo com todos os presentes (membros e convidado); o ausente não assina', () => {
    const d = completo();
    const grupos = cipa.assinaturas(d);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.titulo).toBeNull();
    expect(grupos[0]?.pessoas).toHaveLength(presentes(d).length);
    expect(grupos[0]?.pessoas).toEqual([
      { nome: 'Carla Mendes', papel: 'Representante da organização — Titular' },
      { nome: 'Diego Faria', papel: 'Representante dos empregados — Titular' },
      { nome: 'Elisa Prado', papel: 'Representante dos empregados — Suplente' },
      { nome: 'Gisele Torres', papel: 'Convidado(a) (não membro)' },
    ]);
    expect(grupos[0]?.pessoas.map((p) => p.nome)).not.toContain('Fábio Ramos');
  });

  it('assinatura sem representação nem condição válidas usa o cargo digitado', () => {
    const d = rascunho({}, { participantes: [pessoa('x', 'Hugo Lins', { representacao: 'x' })] });
    expect(cipa.assinaturas(d)).toEqual([
      { titulo: null, pessoas: [{ nome: 'Hugo Lins', papel: 'Analista' }] },
    ]);
  });
});

describe('CIPA: documento', () => {
  const fixtures = [completo(), porAcidente(), porSolicitacao(), hibrida()];
  const textos = fixtures.map((d) => textosDoDocumento(construirDocumento(d, cipa)).join('\n'));

  it('todo texto fixo aparece no documento de algum fixture (constante sem uso reprova)', () => {
    for (const [chave, valor] of Object.entries(cipa.textosFixos ?? {})) {
      expect(
        textos.some((t) => t.includes(valor)),
        `texto fixo “${chave}” fora do documento`,
      ).toBe(true);
    }
  });

  it('termina com o aviso de minuta seguido do aviso de disponibilização', () => {
    const modelo = construirDocumento(completo(), cipa);
    const avisos = modelo.blocos.slice(-2);
    expect(avisos).toEqual([
      { tipo: 'aviso', texto: AVISO_MINUTA },
      {
        tipo: 'aviso',
        texto:
          'Disponibilize esta ata a todos os integrantes da CIPA (NR-5, item 5.6.3.1) e divulgue as deliberações e os encaminhamentos a todos os empregados, em quadro de aviso ou por meio eletrônico (NR-5, item 5.6.3.2).',
      },
    ]);
  });

  it('colunas de participantes: Nome, Cargo / função, Representação, Condição, Presença', () => {
    const modelo = construirDocumento(completo(), cipa);
    const tabela = modelo.blocos.find(
      (b): b is Extract<DocBloco, { tipo: 'tabela' }> => b.tipo === 'tabela',
    );
    expect(tabela?.colunas).toEqual([
      'Nome',
      'Cargo / função',
      'Representação',
      'Condição',
      'Presença',
    ]);
    expect(tabela?.linhas[4]).toEqual([
      'Gisele Torres',
      'Técnica de segurança',
      'Convidado(a) (não membro)',
      '—',
      'Presente',
    ]);
  });
});

describe('CIPA: prompt', () => {
  const d = completo();
  const { sistema, usuario } = montarPrompt(cipa, d, d.transcricao);
  const enviado = `${sistema}\n${usuario}`;

  it('contém as 6 regras do tipo', () => {
    expect(cipa.regrasPrompt).toHaveLength(6);
    for (const regra of cipa.regrasPrompt) expect(sistema).toContain(regra);
  });

  it('leva representação e condição dos participantes', () => {
    expect(usuario).toContain(
      'Diego Faria — Analista — Representante dos empregados — Titular — presente',
    );
    expect(usuario).toContain('nome — cargo / função — representação — condição — presença');
  });

  it('não cita itens da norma nem leva gestão, empresa ou local', () => {
    expect(enviado).not.toContain('5.6.');
    expect(enviado).not.toContain('Gestão');
    expect(enviado).not.toContain('2026/2027');
    expect(enviado).not.toContain('Empresa Exemplo');
    expect(enviado).not.toContain('Sala de Treinamento');
  });

  it('leva natureza, presidente e secretário', () => {
    expect(usuario).toContain('Natureza: Ordinária');
    expect(usuario).toContain('Presidente: Carla Mendes');
    expect(usuario).toContain('Secretário(a) designado(a): Diego Faria');
  });
});
