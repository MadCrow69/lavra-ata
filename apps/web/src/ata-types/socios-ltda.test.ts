import { describe, expect, it } from 'vitest';
import { AVISO_MINUTA } from '../config/documento';
import { construirDocumento, textosDoDocumento } from '../document/build-model';
import type { DocBloco } from '../document/model';
import type { AtaDraft, Participante, ResultadoAta } from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';
import { montarPrompt } from '../generation/prompt';
import { MENSAGEM_CNPJ_INVALIDO, presentes } from './comum-formal';
import {
  ATA_TYPES,
  camposFaltando,
  colunasDeParticipantes,
  ehVisivel,
  obterTipo,
  problemaDoCampo,
} from './registry';
import { sociosLtda } from './socios-ltda';

type Dados = Record<string, string>;

const DADOS_COMPLETOS: Dados = {
  razao_social: 'Empresa Exemplo Ltda.',
  cnpj: '11.222.333/0001-81',
  nire: '35212345678',
  sede: 'Rua das Flores, 100, Centro, Cidade Exemplo/SP',
  forma: 'reuniao',
  data: '2026-10-14',
  inicio: '10:00',
  fim: '11:30',
  modalidade: 'presencial',
  local: 'Sala de reuniões da sede',
  convocacao: 'presenca_todos',
  presidente: 'Ana Souza',
  secretario: 'Bruno Lima',
  modo_capital: 'percentual',
  declaracao_formalidades: 'sim',
};

function socio(
  id: string,
  nome: string,
  extras: Dados,
  parcial: Partial<Participante> = {},
): Participante {
  return { id, nome, papel: '', presenca: 'presente', justificativa: '', extras, ...parcial };
}

/** 50 + 37,5 + 12,5 = 100%; todos presentes, Bruno representado por Carla. */
const SOCIOS: Participante[] = [
  socio('s1', 'Ana Souza', { participacao: '50' }),
  socio('s2', 'Bruno Lima', { participacao: '37,5', procurador: 'Carla Dias' }),
  socio('s3', 'Diego Faria', { participacao: '12,5' }),
];

const par = (texto: string) => ({ tipo: 'paragrafo' as const, texto, itens: [] });

const RESULTADO: ResultadoAta = {
  secoes: Object.fromEntries(
    sociosLtda.secoes.map((s) => [s.chave, [par(`Texto de ${s.titulo}.`)]]),
  ),
  encaminhamentos: [
    { acao: 'Registrar a ata', responsavel: 'Ana Souza', prazo: '', status: 'pendente' },
  ],
  atribuicao: {},
  avisos: {},
  editadas: [],
};

function rascunho(dados: Dados = {}, sobrescrever: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(sociosLtda.id),
    dados: { ...DADOS_COMPLETOS, ...dados },
    pauta: ['Aprovação das contas de 2025', 'Eleição de administrador'],
    participantes: SOCIOS,
    transcricao: 'Ana: bom dia a todos.',
    resultado: RESULTADO,
    ...sobrescrever,
  };
}

const semProcurador = SOCIOS.map((p) => ({
  ...p,
  extras: { participacao: p.extras.participacao ?? '' },
}));

const presencial = () => rascunho();
const digital = () =>
  rascunho({
    forma: 'assembleia',
    modalidade: 'remota',
    local: '',
    plataforma: 'Sala virtual da empresa',
    participacao_distancia: 'boletim',
    convocacao: 'edital',
    convocacao_detalhe: 'Diário Oficial do Estado e Jornal Exemplo, em 1º, 2 e 3/10/2026',
    declaracao_formalidades: '',
  });
const semipresencial = () =>
  rascunho({
    modalidade: 'hibrida',
    plataforma: 'Sala virtual da empresa',
    participacao_distancia: 'ambos',
    convocacao: 'contrato',
    convocacao_detalhe: 'e-mail com confirmação de recebimento enviado em 01/10/2026',
  });
const cienciaEscrita = () =>
  rascunho({ convocacao: 'ciencia_escrita' }, { participantes: semProcurador });
const emQuotas = () =>
  rascunho(
    { modo_capital: 'quotas', total_quotas: '8.000' },
    {
      participantes: [
        socio('s1', 'Ana Souza', { participacao: '4.000' }),
        socio('s2', 'Bruno Lima', { participacao: '3.000', procurador: 'Carla Dias' }),
        socio('s3', 'Diego Faria', { participacao: '1.000' }, { presenca: 'ausente' }),
      ],
    },
  );

const faltas = (d: AtaDraft) => camposFaltando(d, sociosLtda).map((f) => f.rotulo);
const campo = (id: string) => sociosLtda.campos.find((c) => c.id === id);
const campoSocio = (id: string) => sociosLtda.camposParticipante.find((c) => c.id === id);
/** O preâmbulo une os parágrafos por espaço: os testes conferem frases inteiras. */
const preambulo = (d: AtaDraft) => sociosLtda.preambulo(d);
const resumo = (d: AtaDraft) => sociosLtda.resumoDosParticipantes?.(d) ?? null;

describe('sócios de Ltda: registro', () => {
  it('está registrado pelo id, com rótulos próprios', () => {
    expect(ATA_TYPES['socios-ltda']).toBe(sociosLtda);
    expect(obterTipo('socios-ltda')).toBe(sociosLtda);
    expect(sociosLtda.rotulo).toBe('Sócios de Ltda — reunião ou assembleia');
    expect(sociosLtda.descricao).toBe(
      'Deliberação dos sócios de sociedade limitada (Código Civil e DREI).',
    );
    expect(sociosLtda.rotulos).toEqual({ participantes: 'Sócios', pauta: 'Ordem do dia' });
    expect(sociosLtda.rotuloPapel).toBeNull();
    expect(sociosLtda.campoComplemento).toBe('participacao');
    expect(sociosLtda.temEncaminhamentos).toBe(true);
    expect(sociosLtda.camposNoPrompt).toEqual([
      'data',
      'forma',
      'modalidade',
      'convocacao',
      'presidente',
      'secretario',
    ]);
    expect(Object.keys(sociosLtda.textosFixos ?? {}).sort()).toEqual(
      [
        'localDigital',
        'localSemipresencial',
        'capitalPresenteAbertura',
        'capitalPresente',
        'mesa',
        'convocacaoPresencaTodos',
        'convocacaoCienciaEscrita',
        'convocacaoContrato',
        'convocacaoEdital',
        'convocacaoEditalNorma',
        'participacaoDistancia',
        'participacaoDistanciaNorma',
        'declaracaoFormalidades',
        'fechoComPresentes',
        'avisoArquivamento',
        'avisoArquivamentoNorma',
        'avisoProcuracao',
      ].sort(),
    );
  });

  it('seções na ordem do documento', () => {
    expect(sociosLtda.secoes.map((s) => [s.chave, s.titulo])).toEqual([
      ['instalacao', 'Instalação'],
      ['deliberacoes', 'Deliberações'],
      ['encerramento', 'Encerramento'],
    ]);
    const instrucoes = sociosLtda.secoes.map((s) => s.instrucao).join('\n');
    expect(instrucoes).toContain('[PREENCHER: quórum de instalação]');
    expect(instrucoes).toContain('[PREENCHER: votos e quórum de aprovação]');
  });
});

describe('sócios de Ltda: campos', () => {
  it('rascunhos completos não têm faltas', () => {
    for (const d of [presencial(), digital(), semipresencial(), cienciaEscrita(), emQuotas()]) {
      expect(faltas(d)).toEqual([]);
    }
  });

  it('obrigatórios do tipo em rascunho vazio, na ordem do formulário', () => {
    expect(faltas({ ...criarRascunho(sociosLtda.id), participantes: SOCIOS })).toEqual([
      'Nome empresarial',
      'CNPJ',
      'Endereço da sede',
      'Forma',
      'Data',
      'Início',
      'Modalidade',
      'Convocação',
      'Presidente',
      'Secretário(a)',
      'Participação informada em',
      'Ordem do dia',
      'Transcrição',
    ]);
    expect(campo('declaracao_formalidades')?.ajuda).toBe(
      'Exigida para o registro (Manual DREI). Sem ela, a ata sai com [PREENCHER].',
    );
    expect(campo('total_quotas')?.teclado).toBe('numeric');
    expect(campoSocio('participacao')?.teclado).toBe('decimal');
  });

  it('CNPJ com dígito errado e NIRE fora de 11 dígitos são faltas com a mensagem', () => {
    const errado = rascunho({ cnpj: '11.222.333/0001-82', nire: '3521234567' });
    expect(faltas(errado)).toEqual(['CNPJ (corrigir)', 'NIRE (corrigir)']);
    const cnpj = campo('cnpj');
    const nire = campo('nire');
    expect(cnpj && problemaDoCampo(cnpj, errado.dados.cnpj, errado.dados)).toEqual({
      tipo: 'invalido',
      mensagem: MENSAGEM_CNPJ_INVALIDO,
    });
    expect(nire && problemaDoCampo(nire, errado.dados.nire, errado.dados)).toEqual({
      tipo: 'invalido',
      mensagem: 'O NIRE tem 11 dígitos.',
    });
    expect(faltas(rascunho({ nire: '35.2.1234567-8' }))).toEqual([]);
    expect(faltas(rascunho({ nire: '' }))).toEqual([]);
  });

  it('local, sistema eletrônico e participação a distância conforme a modalidade', () => {
    const visivel = (id: string, modalidade: string) => {
      const c = campo(id);
      return c !== undefined && ehVisivel(c, { modalidade });
    };
    for (const [modalidade, local, plataforma] of [
      ['presencial', true, false],
      ['remota', false, true],
      ['hibrida', true, true],
    ] as const) {
      expect(visivel('local', modalidade)).toBe(local);
      expect(visivel('plataforma', modalidade)).toBe(plataforma);
      expect(visivel('participacao_distancia', modalidade)).toBe(plataforma);
    }
    expect(faltas(rascunho({ local: '' }))).toEqual(['Local']);
    expect(faltas(rascunho({ modalidade: 'remota', local: '' }))).toEqual([
      'Sistema eletrônico',
      'Participação e voto a distância',
    ]);
  });

  it('detalhe da convocação: só no contrato e no edital, com rótulo próprio', () => {
    const detalhe = campo('convocacao_detalhe');
    expect(detalhe && ehVisivel(detalhe, { convocacao: 'presenca_todos' })).toBe(false);
    expect(faltas(rascunho({ convocacao: 'edital' }))).toEqual([
      'Veículos e datas das publicações',
    ]);
    expect(faltas(rascunho({ convocacao: 'contrato' }))).toEqual(['Meio e data da convocação']);
  });

  it('participação: "33,333" é falta "Participação (%) (corrigir)" com a mensagem do modo', () => {
    const d = rascunho(
      {},
      { participantes: [socio('x', 'Ana Souza', { participacao: '33,333' }), ...SOCIOS.slice(1)] },
    );
    expect(faltas(d)).toEqual(['Participação (%) (corrigir)']);
    const participacao = campoSocio('participacao');
    expect(participacao && problemaDoCampo(participacao, '33,333', d.dados)).toEqual({
      tipo: 'invalido',
      mensagem: 'Use um percentual de 0 a 100, com até duas casas decimais (ex.: 33,33).',
    });
    for (const invalido of ['abc', '-5', '1.000']) {
      expect(participacao && problemaDoCampo(participacao, invalido, d.dados)?.tipo).toBe(
        'invalido',
      );
    }
  });

  it('modo quotas: rótulo "Quotas", mensagem própria e total obrigatório', () => {
    const d = emQuotas();
    const participacao = campoSocio('participacao');
    expect(participacao && problemaDoCampo(participacao, '1,5', d.dados)).toEqual({
      tipo: 'invalido',
      mensagem: 'Use um número inteiro de quotas (ex.: 1.000).',
    });
    expect(colunasDeParticipantes(sociosLtda, d.dados).map((c) => c.rotulo)).toEqual([
      'Nome',
      'Quotas',
      'Representado(a) por',
      'Presença',
    ]);
    expect(faltas(rascunho({ modo_capital: 'quotas', total_quotas: '' }))).toContain(
      'Total de quotas do capital',
    );
    const total = campo('total_quotas');
    expect(total && problemaDoCampo(total, '1.00', d.dados)).toEqual({
      tipo: 'invalido',
      mensagem: 'Use um número inteiro de quotas (ex.: 1.000).',
    });
  });
});

describe('sócios de Ltda: título e cabeçalho', () => {
  it('título com a forma e o nome empresarial; sem forma; forma inválida', () => {
    expect(sociosLtda.titulo(DADOS_COMPLETOS)).toBe(
      'Ata de Reunião de Sócios — Empresa Exemplo Ltda.',
    );
    expect(sociosLtda.titulo({ ...DADOS_COMPLETOS, forma: 'assembleia' })).toBe(
      'Ata de Assembleia de Sócios — Empresa Exemplo Ltda.',
    );
    expect(sociosLtda.titulo({ ...DADOS_COMPLETOS, forma: '' })).toBe(
      'Ata de Reunião ou Assembleia de Sócios — Empresa Exemplo Ltda.',
    );
    expect(sociosLtda.titulo({ forma: 'constructor' })).toBe(
      'Ata de Reunião ou Assembleia de Sócios',
    );
  });

  it('cabeçalho com nome, CNPJ, NIRE, sede e dados da reunião', () => {
    expect(sociosLtda.cabecalho(semipresencial())).toEqual([
      'Empresa Exemplo Ltda.',
      'CNPJ: 11.222.333/0001-81',
      'NIRE: 35212345678',
      'Sede: Rua das Flores, 100, Centro, Cidade Exemplo/SP',
      'Data: 14/10/2026',
      'Horário: 10h às 11h30',
      'Modalidade: Semipresencial',
      'Local: Sala de reuniões da sede',
      'Sistema eletrônico: Sala virtual da empresa',
    ]);
    expect(sociosLtda.cabecalho(rascunho({ nire: '' }))).not.toContain('NIRE: ');
    expect(sociosLtda.cabecalho(criarRascunho(sociosLtda.id))).toEqual([]);
  });
});

describe('sócios de Ltda: preâmbulo', () => {
  it('presencial, todos presentes e declaração de formalidades: texto completo', () => {
    expect(preambulo(presencial())).toBe(
      [
        'Aos catorze dias do mês de outubro de dois mil e vinte e seis, às 10h, em Sala de reuniões da sede, reuniram-se em reunião os sócios de Empresa Exemplo Ltda., inscrita no CNPJ sob o nº 11.222.333/0001-81, NIRE 35212345678, com sede em Rua das Flores, 100, Centro, Cidade Exemplo/SP.',
        'Estiveram presentes ou representados sócios titulares de 100% do capital social, conforme as participações informadas na relação a seguir.',
        'Composição da mesa: Ana Souza, presidente, e Bruno Lima, secretário(a).',
        'Dispensadas as formalidades de convocação, nos termos do art. 1.072, § 2º, do Código Civil, em razão do comparecimento de todos os sócios.',
        'A mesa declarou atendidas as formalidades legais para a realização da reunião.',
      ].join(' '),
    );
  });

  it('digital com boletim: considerada realizada na sede e parágrafo da participação a distância', () => {
    const texto = preambulo(digital());
    expect(texto).toContain(
      'às 10h, de forma digital, considerada realizada na sede da sociedade, por meio de Sala virtual da empresa, reuniram-se em assembleia os sócios',
    );
    expect(texto).toContain(
      'A assembleia foi realizada de forma digital, com participação e votação a distância mediante boletim de voto a distância, nos termos do art. 1.080-A do Código Civil.',
    );
  });

  it('semipresencial: local e sistema; contrato social com o detalhe', () => {
    const texto = preambulo(semipresencial());
    expect(texto).toContain(
      'às 10h, de forma semipresencial, em Sala de reuniões da sede e por meio de Sala virtual da empresa, reuniram-se em reunião',
    );
    expect(texto).toContain(
      'A reunião foi realizada de forma semipresencial, com participação e votação a distância mediante sistema eletrônico e boletim de voto a distância, nos termos do art. 1.080-A do Código Civil.',
    );
    expect(texto).toContain(
      'Convocação realizada na forma do contrato social: e-mail com confirmação de recebimento enviado em 01/10/2026.',
    );
    expect(preambulo(presencial())).not.toContain('a distância');
  });

  it('edital com o detalhe; detalhe vazio vira lacuna', () => {
    expect(preambulo(digital())).toContain(
      'Convocação por edital publicado em Diário Oficial do Estado e Jornal Exemplo, em 1º, 2 e 3/10/2026, nos termos do art. 1.152, § 3º, do Código Civil.',
    );
    expect(preambulo(rascunho({ convocacao: 'edital', convocacao_detalhe: ' ' }))).toContain(
      'Convocação por edital publicado em [PREENCHER: veículos e datas das publicações], nos termos',
    );
  });

  it('ciência por escrito', () => {
    expect(preambulo(cienciaEscrita())).toContain(
      'Dispensadas as formalidades de convocação, nos termos do art. 1.072, § 2º, do Código Civil, por terem todos os sócios declarado, por escrito, ciência do local, da data, da hora e da ordem do dia.',
    );
  });

  it('sem a declaração de formalidades, lacuna', () => {
    expect(preambulo(digital())).toContain(
      '[PREENCHER: declaração da mesa de que foram atendidas as formalidades legais]',
    );
    expect(preambulo(digital())).not.toContain('A mesa declarou');
  });

  it('participações somando 110%: capital presente vira lacuna', () => {
    const d = rascunho(
      {},
      { participantes: [...SOCIOS, socio('s4', 'Elisa Prado', { participacao: '10' })] },
    );
    expect(preambulo(d)).toContain(
      'sócios titulares de [PREENCHER: capital social representado pelos presentes] do capital social',
    );
  });

  it('em quotas: "7.000 de 8.000 quotas (87,5%)"', () => {
    expect(preambulo(emQuotas())).toContain(
      'sócios titulares de 7.000 de 8.000 quotas (87,5%) do capital social, conforme as participações informadas',
    );
  });

  it('dados ausentes viram [PREENCHER: …] e nunca lançam', () => {
    const texto = preambulo({ ...criarRascunho(sociosLtda.id), dados: {} });
    for (const lacuna of [
      'data',
      'horário de início',
      'modalidade e local',
      'reunião ou assembleia',
      'nome empresarial',
      'CNPJ',
      'endereço da sede',
      'capital social representado pelos presentes',
      'presidente',
      'secretário(a)',
      'forma de convocação',
      'declaração da mesa de que foram atendidas as formalidades legais',
    ]) {
      expect(texto).toContain(`[PREENCHER: ${lacuna}]`);
    }
    expect(texto).not.toContain('NIRE');
    expect(preambulo(rascunho({ modalidade: 'remota', participacao_distancia: '' }))).toContain(
      'mediante [PREENCHER: forma de participação e voto a distância]',
    );
  });
});

describe('sócios de Ltda: fecho, assinaturas e avisos', () => {
  it('fecho lista os sócios presentes, com o procurador', () => {
    expect(sociosLtda.fecho(presencial())).toBe(
      'Nada mais havendo a tratar, foi encerrada a reunião às 11h30, da qual se lavrou a presente ata, que, lida e achada conforme, vai assinada pelos membros da mesa e pelos sócios presentes. Sócios presentes: Ana Souza; Bruno Lima, representado(a) por Carla Dias; Diego Faria.',
    );
    const d = emQuotas();
    expect(sociosLtda.fecho(d)).toContain(
      'Sócios presentes: Ana Souza; Bruno Lima, representado(a) por Carla Dias.',
    );
  });

  it('sem presentes nem término: lacuna e sem horário', () => {
    const d = rascunho(
      { fim: '' },
      { participantes: SOCIOS.map((p) => ({ ...p, presenca: 'ausente' as const })) },
    );
    expect(sociosLtda.fecho(d)).toBe(
      'Nada mais havendo a tratar, foi encerrada a reunião, da qual se lavrou a presente ata, que, lida e achada conforme, vai assinada pelos membros da mesa e pelos sócios presentes. Sócios presentes: [PREENCHER: sócios presentes].',
    );
  });

  it('assinaturas: grupo "Mesa" e grupo "Sócios presentes", o procurador assina pelo sócio', () => {
    const d = emQuotas();
    const grupos = sociosLtda.assinaturas(d);
    expect(grupos).toEqual([
      {
        titulo: 'Mesa',
        pessoas: [
          { nome: 'Ana Souza', papel: 'Presidente' },
          { nome: 'Bruno Lima', papel: 'Secretário(a)' },
        ],
      },
      {
        titulo: 'Sócios presentes',
        pessoas: [
          { nome: 'Ana Souza', papel: 'Sócio(a)' },
          { nome: 'Carla Dias', papel: 'Procurador(a) de Bruno Lima' },
        ],
      },
    ]);
    expect(grupos[1]?.pessoas).toHaveLength(presentes(d).length);
  });

  it('assinaturas: sem mesa informada, só os sócios; sem presentes, só a mesa', () => {
    expect(
      sociosLtda.assinaturas(rascunho({ presidente: '', secretario: ' ' })).map((g) => g.titulo),
    ).toEqual(['Sócios presentes']);
    const semPresentes = rascunho(
      {},
      { participantes: SOCIOS.map((p) => ({ ...p, presenca: 'justificado' as const })) },
    );
    expect(sociosLtda.assinaturas(semPresentes).map((g) => g.titulo)).toEqual(['Mesa']);
  });

  it('avisos: arquivamento sempre; procuração só com procurador entre os presentes', () => {
    const avisos = (d: AtaDraft) => sociosLtda.avisosFinais?.(d) ?? [];
    expect(avisos(presencial())).toEqual([
      'Arquivamento: apresente cópia desta ata à Junta Comercial nos 20 dias seguintes à reunião (Código Civil, art. 1.075, § 2º). Peça a conferência de um profissional (advogado ou contador) antes de assinar e registrar.',
      'Representação por procurador: o procurador deve ser outro sócio ou advogado, e o mandato deve especificar os atos autorizados e acompanhar a ata no registro, salvo disposição diversa do contrato social (Código Civil, art. 1.074, § 1º; Manual de Registro de Sociedade Limitada do DREI).',
    ]);
    expect(avisos(cienciaEscrita())).toHaveLength(1);
    expect(avisos(digital())[0]).toContain('nos 20 dias seguintes à assembleia (');
    // Procurador de sócio ausente não assina: sem aviso.
    const ausente = rascunho(
      {},
      {
        participantes: [
          socio('s1', 'Ana Souza', { participacao: '60' }),
          socio(
            's2',
            'Bruno Lima',
            { participacao: '40', procurador: 'Carla Dias' },
            { presenca: 'ausente' },
          ),
        ],
      },
    );
    expect(avisos(ausente)).toHaveLength(1);
  });
});

describe('sócios de Ltda: resumo dos participantes', () => {
  it('capital presente informado, sem alertas, quando soma 100%', () => {
    expect(resumo(presencial())).toEqual({
      texto: 'Capital presente informado: 100%',
      alertas: [],
    });
    expect(resumo(emQuotas())?.texto).toBe(
      'Capital presente informado: 7.000 de 8.000 quotas (87,5%)',
    );
  });

  it('soma acima de 100%: sem texto e com o alerta de correção', () => {
    const d = rascunho(
      {},
      { participantes: [...SOCIOS, socio('s4', 'Elisa Prado', { participacao: '10' })] },
    );
    expect(resumo(d)).toEqual({
      texto: null,
      alertas: [
        'As participações informadas somam 110%, acima de 100%. Corrija: a ata sai com [PREENCHER] no capital presente.',
      ],
    });
  });

  it('soma acima do total de quotas', () => {
    const d = rascunho(
      { modo_capital: 'quotas', total_quotas: '1.000' },
      {
        participantes: [
          socio('s1', 'Ana Souza', { participacao: '600' }),
          socio('s2', 'Bruno Lima', { participacao: '500' }),
        ],
      },
    );
    expect(resumo(d)?.alertas).toEqual([
      'As participações informadas somam 1.100 quotas, acima do total de 1.000 quotas. Corrija: a ata sai com [PREENCHER] no capital presente.',
    ]);
  });

  it('soma abaixo de 100% e "todos compareceram" com ausentes: alertas na ordem fixa', () => {
    const d = rascunho(
      {},
      {
        participantes: [
          socio('s1', 'Ana Souza', { participacao: '50' }),
          socio('s2', 'Bruno Lima', { participacao: '20' }, { presenca: 'ausente' }),
          socio('s3', 'Diego Faria', { participacao: '10' }, { presenca: 'justificado' }),
        ],
      },
    );
    expect(resumo(d)).toEqual({
      texto: 'Capital presente informado: 50%',
      alertas: [
        'As participações informadas somam 80%. Se faltam sócios na lista, inclua-os (inclusive os ausentes).',
        'Você indicou que todos os sócios compareceram, mas 2 sócios estão marcados como ausentes.',
      ],
    });
    const um = rascunho(
      {},
      {
        participantes: [
          socio('s1', 'Ana Souza', { participacao: '50' }),
          socio('s2', 'Bruno Lima', { participacao: '50' }, { presenca: 'ausente' }),
        ],
      },
    );
    expect(resumo(um)?.alertas).toEqual([
      'Você indicou que todos os sócios compareceram, mas 1 sócio está marcado como ausente.',
    ]);
  });

  it('soma abaixo do total de quotas', () => {
    const d = rascunho(
      { modo_capital: 'quotas', total_quotas: '1.000' },
      {
        participantes: [socio('s1', 'Ana Souza', { participacao: '600' })],
      },
    );
    expect(resumo(d)?.alertas).toEqual([
      'As participações informadas somam 600 quotas. Se faltam sócios na lista, inclua-os (inclusive os ausentes).',
    ]);
  });

  it('11 sócios em reunião: alerta do art. 1.072, § 1º; em assembleia, não', () => {
    const onze = Array.from({ length: 11 }, (_, i) =>
      socio(`s${String(i)}`, `Sócio ${String(i + 1)}`, { participacao: i === 0 ? '10,00' : '9' }),
    );
    const alertaOnze =
      'A lista tem 11 sócios: com mais de dez, o Código Civil exige assembleia (art. 1.072, § 1º). Confira a forma escolhida.';
    expect(resumo(rascunho({}, { participantes: onze }))?.alertas).toEqual([alertaOnze]);
    expect(resumo(rascunho({ forma: 'assembleia' }, { participantes: onze }))?.alertas).toEqual([]);
    expect(
      resumo(rascunho({}, { participantes: onze.slice(0, 10) }))?.alertas.some((a) =>
        a.includes('1.072'),
      ),
    ).toBe(false);
  });

  it('valor inválido: sem texto e sem alerta de soma (a célula mostra o erro)', () => {
    const d = rascunho(
      {},
      { participantes: [socio('x', 'Ana Souza', { participacao: 'abc' }), ...SOCIOS.slice(1)] },
    );
    expect(resumo(d)).toEqual({ texto: null, alertas: [] });
  });
});

describe('sócios de Ltda: documento', () => {
  const fixtures = [presencial(), digital(), semipresencial(), cienciaEscrita(), emQuotas()];
  const textos = fixtures.map((d) =>
    textosDoDocumento(construirDocumento(d, sociosLtda)).join('\n'),
  );

  it('todo texto fixo aparece no documento de algum fixture (constante sem uso reprova)', () => {
    for (const [chave, valor] of Object.entries(sociosLtda.textosFixos ?? {})) {
      expect(
        textos.some((t) => t.includes(valor)),
        `texto fixo “${chave}” fora do documento`,
      ).toBe(true);
    }
  });

  it('termina com o aviso de minuta e os avisos do tipo; o resumo do formulário não entra', () => {
    const doc = construirDocumento(presencial(), sociosLtda);
    expect(doc.blocos.slice(-3).map((b) => b.tipo)).toEqual(['aviso', 'aviso', 'aviso']);
    expect(doc.blocos.at(-3)).toEqual({ tipo: 'aviso', texto: AVISO_MINUTA });
    expect(textosDoDocumento(doc).join('\n')).not.toContain('Capital presente informado');
  });

  it('colunas: Nome, Participação (%), Representado(a) por, Presença; valores como digitados', () => {
    const tabela = construirDocumento(presencial(), sociosLtda).blocos.find(
      (b): b is Extract<DocBloco, { tipo: 'tabela' }> => b.tipo === 'tabela',
    );
    expect(tabela?.colunas).toEqual([
      'Nome',
      'Participação (%)',
      'Representado(a) por',
      'Presença',
    ]);
    expect(tabela?.linhas[1]).toEqual(['Bruno Lima', '37,5', 'Carla Dias', 'Presente']);
  });
});

describe('sócios de Ltda: prompt', () => {
  const d = emQuotas();
  const { sistema, usuario } = montarPrompt(sociosLtda, d, d.transcricao);
  const enviado = `${sistema}\n${usuario}`;

  it('contém as regras do tipo, inclusive a que proíbe calcular e a do quórum de memória', () => {
    expect(sociosLtda.regrasPrompt).toHaveLength(5);
    for (const regra of sociosLtda.regrasPrompt) expect(sistema).toContain(regra);
    expect(sistema).toContain(
      'Não calcule quórum nem percentuais de capital. Não escreva "totalidade do capital", "maioria" nem "unanimidade" sem que isso tenha sido dito na reunião ou assembleia.',
    );
    expect(sistema).toContain(
      'Não cite quórum legal nem artigo de lei de memória: a lei mudou e o contrato social pode dispor de outra forma. Registre só o quórum que foi declarado.',
    );
  });

  it('leva o procurador, nunca a participação nem o total de quotas', () => {
    expect(usuario).toContain('nome — representado(a) por — presença');
    expect(usuario).toContain('Bruno Lima — Carla Dias — presente');
    for (const fora of ['4.000', '3.000', '8.000', 'Quotas', 'quotas', 'Participação']) {
      expect(enviado).not.toContain(fora);
    }
    const percentual = montarPrompt(sociosLtda, presencial(), 'x');
    expect(`${percentual.sistema}\n${percentual.usuario}`).not.toContain('37,5');
  });

  it('leva forma, modalidade, convocação e a mesa; nunca nome, CNPJ, NIRE, sede, local ou detalhe', () => {
    expect(usuario).toContain('Forma: Reunião de sócios');
    expect(usuario).toContain('Modalidade: Presencial');
    expect(usuario).toContain('Convocação: Dispensada: todos os sócios presentes');
    expect(usuario).toContain('Presidente: Ana Souza');
    expect(usuario).toContain('Secretário(a): Bruno Lima');
    const dig = montarPrompt(sociosLtda, digital(), 'x');
    for (const fora of [
      'Empresa Exemplo',
      '11.222.333',
      '35212345678',
      'Rua das Flores',
      'Sala de reuniões',
      'Diário Oficial',
      'Sala virtual',
    ]) {
      expect(enviado).not.toContain(fora);
      expect(`${dig.sistema}\n${dig.usuario}`).not.toContain(fora);
    }
    expect(enviado).not.toMatch(/art\. ?1\.0/);
  });
});
