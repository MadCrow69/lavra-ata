import { describe, expect, it } from 'vitest';
import { AVISO_MINUTA } from '../config/documento';
import { construirDocumento, contarPreencher, textosDoDocumento } from '../document/build-model';
import type { DocBloco } from '../document/model';
import type { AtaDraft, Participante, ResultadoAta } from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';
import { montarPrompt } from '../generation/prompt';
import { MENSAGEM_CNPJ_INVALIDO, presentes } from './comum-formal';
import { condominio } from './condominio';
import { ATA_TYPES, camposFaltando, ehVisivel, obterTipo, problemaDoCampo } from './registry';

type Dados = Record<string, string>;

const DADOS_COMPLETOS: Dados = {
  condominio: 'Condomínio Edifício Exemplo',
  cnpj: '11.222.333/0001-81',
  endereco: 'Rua das Flores, 100, Centro, Cidade Exemplo/SP',
  natureza: 'ordinaria',
  chamada: 'segunda',
  edital_data: '2026-10-01',
  data: '2026-10-14',
  inicio: '19:30',
  fim: '21:45',
  modalidade: 'presencial',
  local: 'Salão de festas',
  presidente: 'Carla Mendes',
  secretario: 'Diego Faria',
  assinaturas_presentes: 'mesa',
};

function pessoa(
  id: string,
  nome: string,
  extras: Dados,
  parcial: Partial<Participante> = {},
): Participante {
  return { id, nome, papel: '', presenca: 'presente', justificativa: '', extras, ...parcial };
}

/** 3 condôminos presentes e 1 ausente. */
const PARTICIPANTES: Participante[] = [
  pessoa('c1', 'Carla Mendes', { unidade: 'Apto 101', vinculo: 'proprietario', fracao: '0,0125' }),
  pessoa('c2', 'Diego Faria', { unidade: 'Apto 102', vinculo: 'procurador', fracao: '0,0125' }),
  pessoa('c3', 'Elisa Prado', { unidade: 'Apto 201', vinculo: 'locatario' }),
  pessoa(
    'c4',
    'Fábio Ramos',
    { unidade: 'Apto 202', vinculo: 'proprietario' },
    { presenca: 'ausente' },
  ),
];

const par = (texto: string) => ({ tipo: 'paragrafo' as const, texto, itens: [] });

function resultado(ordemDoDia: string): ResultadoAta {
  return {
    secoes: Object.fromEntries(
      condominio.secoes.map((s) => [
        s.chave,
        [par(s.chave === 'ordem_do_dia' ? ordemDoDia : `Texto de ${s.titulo}.`)],
      ]),
    ),
    encaminhamentos: [
      { acao: 'Contratar a pintura', responsavel: 'Carla Mendes', prazo: '', status: 'pendente' },
    ],
    atribuicao: {},
    avisos: {},
    editadas: [],
  };
}

function rascunho(dados: Dados = {}, sobrescrever: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(condominio.id),
    dados: { ...DADOS_COMPLETOS, ...dados },
    pauta: ['Aprovação das contas de 2025', 'Pintura da fachada'],
    participantes: PARTICIPANTES,
    transcricao: 'Carla: boa noite a todos.',
    resultado: resultado('Item 1: contas apresentadas e discutidas.'),
    ...sobrescrever,
  };
}

const presencial = () => rascunho();
const eletronica = () =>
  rascunho({
    natureza: 'extraordinaria',
    chamada: '',
    edital_data: '',
    modalidade: 'remota',
    local: '',
    plataforma: 'Sala virtual do condomínio',
  });
const hibrida = () =>
  rascunho({
    modalidade: 'hibrida',
    plataforma: 'Sala virtual do condomínio',
    assinaturas_presentes: 'todos',
  });

const faltas = (d: AtaDraft) => camposFaltando(d, condominio).map((f) => f.rotulo);
const campo = (id: string) => condominio.campos.find((c) => c.id === id);

describe('condomínio: registro', () => {
  it('está registrado pelo id, com rótulos próprios', () => {
    expect(ATA_TYPES.condominio).toBe(condominio);
    expect(obterTipo('condominio')).toBe(condominio);
    expect(condominio.rotulo).toBe('Condomínio — assembleia geral');
    expect(condominio.descricao).toBe(
      'Assembleia ordinária ou extraordinária de condôminos (Código Civil).',
    );
    expect(condominio.rotulos).toEqual({
      participantes: 'Condôminos',
      pauta: 'Ordem do dia',
      pessoa: { singular: 'condômino', plural: 'condôminos' },
    });
    // A unidade distingue dois condôminos de mesmo nome.
    expect(condominio.complementoIdentifica).toBe(true);
    expect(condominio.rotuloPapel).toBeNull();
    expect(condominio.campoComplemento).toBe('unidade');
    expect(condominio.temEncaminhamentos).toBe(true);
    expect(condominio.camposNoPrompt).toEqual([
      'data',
      'natureza',
      'chamada',
      'modalidade',
      'presidente',
      'secretario',
    ]);
    expect(Object.keys(condominio.textosFixos ?? {}).sort()).toEqual(
      [
        'convocadosEdital',
        'convocadosConvencao',
        'meioEletronico',
        'hibrida',
        'mesa',
        'fechoPresencial',
        'fechoEletronico',
        'avisoConvencao',
      ].sort(),
    );
  });

  it('seções na ordem do documento', () => {
    expect(condominio.secoes.map((s) => [s.chave, s.titulo])).toEqual([
      ['abertura_instalacao', 'Abertura e instalação'],
      ['eleicao_mesa', 'Eleição da mesa'],
      ['ordem_do_dia', 'Deliberações da ordem do dia'],
      ['encerramento', 'Encerramento'],
    ]);
  });
});

describe('condomínio: campos', () => {
  it('rascunhos completos não têm faltas', () => {
    expect(faltas(presencial())).toEqual([]);
    expect(faltas(eletronica())).toEqual([]);
    expect(faltas(hibrida())).toEqual([]);
  });

  it('obrigatórios do tipo em rascunho vazio, na ordem do formulário', () => {
    expect(faltas({ ...criarRascunho(condominio.id), participantes: PARTICIPANTES })).toEqual([
      'Condomínio',
      'Endereço',
      'Natureza',
      'Data',
      'Início',
      'Modalidade',
      'Presidente da mesa',
      'Secretário(a)',
      'Ordem do dia',
      'Transcrição',
    ]);
    expect(campo('condominio')?.ajuda).toBe('Nome do condomínio, como na convenção.');
    expect(campo('assinaturas_presentes')?.ajuda).toBe('Siga o que a convenção exige.');
    expect(campo('modalidade')?.ajuda).toBe(
      'Assembleia eletrônica só se a convenção não a proibir (Código Civil, art. 1.354-A).',
    );
  });

  it('CNPJ: dígito errado é falta com a mensagem na célula; válido com máscara ou vazio, não', () => {
    const cnpj = campo('cnpj');
    expect(cnpj).toBeDefined();
    const errado = rascunho({ cnpj: '11.222.333/0001-82' });
    expect(faltas(errado)).toEqual(['CNPJ (corrigir)']);
    expect(cnpj && problemaDoCampo(cnpj, errado.dados.cnpj, errado.dados)).toEqual({
      tipo: 'invalido',
      mensagem: MENSAGEM_CNPJ_INVALIDO,
    });
    expect(faltas(rascunho({ cnpj: '11.222.333/0001-81' }))).toEqual([]);
    expect(faltas(rascunho({ cnpj: '' }))).toEqual([]);
  });

  it('local só na presencial e na híbrida; plataforma só na eletrônica e na híbrida', () => {
    const visivel = (id: string, modalidade: string) => {
      const c = campo(id);
      return c !== undefined && ehVisivel(c, { modalidade });
    };
    expect([visivel('local', 'presencial'), visivel('local', 'remota')]).toEqual([true, false]);
    expect(visivel('local', 'hibrida')).toBe(true);
    expect([visivel('plataforma', 'presencial'), visivel('plataforma', 'remota')]).toEqual([
      false,
      true,
    ]);
    expect(visivel('plataforma', 'hibrida')).toBe(true);
    expect(faltas(rascunho({ local: '' }))).toEqual(['Local']);
    expect(faltas(rascunho({ modalidade: 'remota', local: '' }))).toEqual([
      'Plataforma eletrônica',
    ]);
    expect(faltas(rascunho({ modalidade: 'hibrida', local: '', plataforma: '' }))).toEqual([
      'Local',
      'Plataforma eletrônica',
    ]);
  });

  it('unidade e vínculo obrigatórios; fração ideal opcional e livre', () => {
    const semUnidade = rascunho(
      {},
      { participantes: [pessoa('x', 'Hugo Lins', { vinculo: 'proprietario' })] },
    );
    expect(faltas(semUnidade)).toEqual(['Unidade']);
    const semVinculo = rascunho(
      {},
      { participantes: [pessoa('x', 'Hugo Lins', { unidade: 'Sala 3' })] },
    );
    expect(faltas(semVinculo)).toEqual(['Vínculo']);
    const fracaoLivre = rascunho(
      {},
      {
        participantes: [
          pessoa('x', 'Hugo Lins', { unidade: 'Loja 1', vinculo: 'locatario', fracao: '1/48' }),
        ],
      },
    );
    expect(faltas(fracaoLivre)).toEqual([]);
  });
});

describe('condomínio: título e cabeçalho', () => {
  it('título com natureza e condomínio; sem natureza ou sem condomínio', () => {
    expect(condominio.titulo(DADOS_COMPLETOS)).toBe(
      'Ata da Assembleia Geral Ordinária — Condomínio Edifício Exemplo',
    );
    expect(condominio.titulo({ ...DADOS_COMPLETOS, natureza: 'extraordinaria' })).toBe(
      'Ata da Assembleia Geral Extraordinária — Condomínio Edifício Exemplo',
    );
    expect(condominio.titulo({ ...DADOS_COMPLETOS, natureza: '' })).toBe(
      'Ata da Assembleia Geral — Condomínio Edifício Exemplo',
    );
    expect(condominio.titulo({ natureza: 'constructor' })).toBe('Ata da Assembleia Geral');
    expect(condominio.titulo({ natureza: 'ordinaria' })).toBe('Ata da Assembleia Geral Ordinária');
  });

  it('cabeçalho com condomínio, CNPJ, endereço e dados da reunião', () => {
    expect(condominio.cabecalho(hibrida())).toEqual([
      'Condomínio Edifício Exemplo',
      'CNPJ: 11.222.333/0001-81',
      'Rua das Flores, 100, Centro, Cidade Exemplo/SP',
      'Data: 14/10/2026',
      'Horário: 19h30 às 21h45',
      'Modalidade: Híbrida (presencial e eletrônica)',
      'Local: Salão de festas',
      'Plataforma eletrônica: Sala virtual do condomínio',
    ]);
    expect(condominio.cabecalho(rascunho({ cnpj: '' }))).not.toContain('CNPJ: ');
    expect(condominio.cabecalho(criarRascunho(condominio.id))).toEqual([]);
  });
});

describe('condomínio: preâmbulo', () => {
  it('presencial, com edital e em segunda convocação', () => {
    expect(condominio.preambulo(presencial())).toBe(
      'Aos catorze dias do mês de outubro de dois mil e vinte e seis, às 19h30, em segunda convocação, em Salão de festas, reuniram-se em Assembleia Geral Ordinária os condôminos do Condomínio Edifício Exemplo, situado em Rua das Flores, 100, Centro, Cidade Exemplo/SP, convocados por edital de 01/10/2026, para deliberar sobre a ordem do dia a seguir. A mesa foi composta por Carla Mendes, presidente, e Diego Faria, secretário(a).',
    );
  });

  it('eletrônica, sem edital e sem convocação informada', () => {
    expect(condominio.preambulo(eletronica())).toBe(
      'Aos catorze dias do mês de outubro de dois mil e vinte e seis, às 19h30, por meio eletrônico, pela plataforma Sala virtual do condomínio, nos termos da convocação, reuniram-se em Assembleia Geral Extraordinária os condôminos do Condomínio Edifício Exemplo, situado em Rua das Flores, 100, Centro, Cidade Exemplo/SP, convocados na forma da convenção, para deliberar sobre a ordem do dia a seguir. A mesa foi composta por Carla Mendes, presidente, e Diego Faria, secretário(a).',
    );
  });

  it('híbrida: local e, simultaneamente, a plataforma', () => {
    expect(condominio.preambulo(hibrida())).toContain(
      'às 19h30, em segunda convocação, em Salão de festas e, simultaneamente, por meio eletrônico, pela plataforma Sala virtual do condomínio, reuniram-se',
    );
  });

  it('primeira convocação e edital com data inválida (cai na convenção)', () => {
    const texto = condominio.preambulo(
      rascunho({ chamada: 'primeira', edital_data: '2026-13-40' }),
    );
    expect(texto).toContain('às 19h30, em primeira convocação, em Salão de festas');
    expect(texto).toContain('convocados na forma da convenção, para deliberar');
    expect(texto).not.toContain('edital');
  });

  it('dados ausentes viram [PREENCHER: …] e nunca lançam', () => {
    const texto = condominio.preambulo({ ...criarRascunho(condominio.id), dados: {} });
    for (const lacuna of [
      'data da assembleia',
      'horário de início',
      'modalidade e local da assembleia',
      'natureza da assembleia',
      'nome do condomínio',
      'endereço',
      'presidente',
      'secretário(a)',
    ]) {
      expect(texto).toContain(`[PREENCHER: ${lacuna}]`);
    }
    const semPlataforma = condominio.preambulo(rascunho({ modalidade: 'remota', plataforma: '' }));
    expect(semPlataforma).toContain('pela plataforma [PREENCHER: plataforma eletrônica]');
  });
});

describe('condomínio: fecho e assinaturas', () => {
  it('fecho presencial, com os condôminos presentes assinando', () => {
    expect(condominio.fecho(rascunho({ assinaturas_presentes: 'todos' }))).toBe(
      'Nada mais havendo a tratar, o presidente encerrou a assembleia às 21h45, e eu, Diego Faria, secretário(a), lavrei a presente ata, que, lida e achada conforme, vai assinada por mim e pelo presidente e pelos condôminos presentes.',
    );
  });

  it('fecho eletrônico, só a mesa assinando', () => {
    expect(condominio.fecho(eletronica())).toBe(
      'Concluída a apuração e divulgado o resultado de todos os votos, o presidente encerrou a assembleia às 21h45, e eu, Diego Faria, secretário(a), lavrei a presente ata, em forma eletrônica, que vai assinada por mim e pelo presidente.',
    );
  });

  it('a híbrida usa o fecho eletrônico; sem término nem secretário, lacuna', () => {
    expect(condominio.fecho(hibrida())).toMatch(
      /^Concluída a apuração e divulgado o resultado de todos os votos, .* e pelos condôminos presentes\.$/,
    );
    expect(condominio.fecho(rascunho({ fim: '', secretario: '' }))).toBe(
      'Nada mais havendo a tratar, o presidente encerrou a assembleia, e eu, [PREENCHER: secretário(a)], secretário(a), lavrei a presente ata, que, lida e achada conforme, vai assinada por mim e pelo presidente.',
    );
  });

  it('assinaturas "mesa" (ou vazio): um grupo "Mesa" com presidente e secretário', () => {
    for (const d of [presencial(), rascunho({ assinaturas_presentes: '' })]) {
      expect(condominio.assinaturas(d)).toEqual([
        {
          titulo: 'Mesa',
          pessoas: [
            { nome: 'Carla Mendes', papel: 'Presidente' },
            { nome: 'Diego Faria', papel: 'Secretário(a)' },
          ],
        },
      ]);
    }
  });

  it('assinaturas "todos": a mesa e um grupo com cada condômino presente (o ausente não assina)', () => {
    const d = rascunho({ assinaturas_presentes: 'todos' });
    const grupos = condominio.assinaturas(d);
    expect(grupos.map((g) => g.titulo)).toEqual(['Mesa', 'Condôminos presentes']);
    const condominos = grupos[1]?.pessoas ?? [];
    expect(condominos).toHaveLength(presentes(d).length);
    expect(condominos).toEqual([
      { nome: 'Carla Mendes', papel: 'Proprietário(a) — unidade Apto 101' },
      { nome: 'Diego Faria', papel: 'Procurador(a) — unidade Apto 102' },
      { nome: 'Elisa Prado', papel: 'Locatário(a) — unidade Apto 201' },
    ]);
    expect(condominos.map((p) => p.nome)).not.toContain('Fábio Ramos');
  });

  it('secretário vazio: a mesa só com o presidente', () => {
    expect(condominio.assinaturas(rascunho({ secretario: ' ' }))).toEqual([
      { titulo: 'Mesa', pessoas: [{ nome: 'Carla Mendes', papel: 'Presidente' }] },
    ]);
  });
});

describe('condomínio: documento', () => {
  const fixtures = [presencial(), eletronica(), hibrida()];
  const textos = fixtures.map((d) =>
    textosDoDocumento(construirDocumento(d, condominio)).join('\n'),
  );

  it('todo texto fixo aparece no documento de algum fixture (constante sem uso reprova)', () => {
    for (const [chave, valor] of Object.entries(condominio.textosFixos ?? {})) {
      expect(
        textos.some((t) => t.includes(valor)),
        `texto fixo “${chave}” fora do documento`,
      ).toBe(true);
    }
  });

  it('termina com o aviso de minuta seguido do aviso da convenção', () => {
    const avisos = construirDocumento(presencial(), condominio).blocos.slice(-2);
    expect(avisos).toEqual([
      { tipo: 'aviso', texto: AVISO_MINUTA },
      { tipo: 'aviso', texto: condominio.textosFixos?.avisoConvencao },
    ]);
    expect(condominio.textosFixos?.avisoConvencao).toBe(
      'Confira a convenção do condomínio: ela define a forma de convocação e o quórum de cada deliberação (Código Civil, art. 1.334, III) e pode definir quem assina a ata.',
    );
  });

  it('colunas: Nome, Unidade, Vínculo, Fração ideal, Presença; a fração sai como digitada', () => {
    const tabela = construirDocumento(presencial(), condominio).blocos.find(
      (b): b is Extract<DocBloco, { tipo: 'tabela' }> => b.tipo === 'tabela',
    );
    expect(tabela?.colunas).toEqual(['Nome', 'Unidade', 'Vínculo', 'Fração ideal', 'Presença']);
    expect(tabela?.linhas[0]).toEqual([
      'Carla Mendes',
      'Apto 101',
      'Proprietário(a)',
      '0,0125',
      'Presente',
    ]);
  });

  it('votação sem resultado dito: a lacuna da ordem do dia soma exatamente 1 à contagem', () => {
    const sem = construirDocumento(presencial(), condominio);
    const com = construirDocumento(
      rascunho(
        {},
        {
          resultado: resultado(
            'Item 2: pintura da fachada posta em votação. [PREENCHER: resultado da votação]',
          ),
        },
      ),
      condominio,
    );
    expect(contarPreencher(com)).toBe(contarPreencher(sem) + 1);
  });
});

describe('condomínio: prompt', () => {
  const d = presencial();
  const { sistema, usuario } = montarPrompt(condominio, d, d.transcricao);
  const enviado = `${sistema}\n${usuario}`;

  it('contém as regras do tipo, inclusive as que proíbem calcular e declarar resultado', () => {
    expect(condominio.regrasPrompt).toHaveLength(5);
    for (const regra of condominio.regrasPrompt) expect(sistema).toContain(regra);
    expect(sistema).toContain(
      'Nunca calcule quórum, maioria, fração ideal nem peso de voto: registre só o que foi declarado na assembleia.',
    );
    expect(sistema).toContain(
      'Não escreva "aprovado", "rejeitado" nem "por unanimidade" sem que o resultado da votação tenha sido dito na assembleia.',
    );
  });

  it('leva o vínculo, mas nunca a unidade nem a fração ideal', () => {
    expect(usuario).toContain('nome — vínculo — presença');
    expect(usuario).toContain('Carla Mendes — Proprietário(a) — presente');
    for (const fora of ['Apto 101', 'Apto 102', '0,0125', 'Fração', 'Unidade']) {
      expect(enviado).not.toContain(fora);
    }
  });

  it('leva natureza, convocação, modalidade e a mesa; nunca nome, CNPJ, endereço ou local', () => {
    expect(usuario).toContain('Natureza: Ordinária (AGO)');
    expect(usuario).toContain('Convocação: Segunda convocação');
    expect(usuario).toContain('Modalidade: Presencial');
    expect(usuario).toContain('Presidente da mesa: Carla Mendes');
    expect(usuario).toContain('Secretário(a): Diego Faria');
    for (const fora of ['Edifício Exemplo', '11.222.333', 'Rua das Flores', 'Salão de festas']) {
      expect(enviado).not.toContain(fora);
    }
    expect(enviado).not.toMatch(/art\. ?1\.3/);
  });
});
