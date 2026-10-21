import type { EntradaDoDocumento } from '../domain/draft';
import {
  CAMPO_DATA,
  CAMPO_FIM,
  CAMPO_INICIO,
  cabecalhoDaReuniao,
  campoModalidade,
  campoTexto,
  sufixoHora,
} from './campos-comuns';
import { linhaSe, ou, presentes, validarCnpj } from './comum-formal';
import {
  dataOuNulo,
  dataPorExtensoOuNulo,
  horaOuNulo,
  preencher,
  rotuloDaOpcao,
  textoLimpo,
} from './texto-modelo';
import type { AtaTypeDefinition, CampoDef, GrupoAssinaturas, SecaoDef } from './types';

/**
 * Ata de assembleia geral de condôminos (Código Civil, arts. 1.334 e 1.350 a 1.355; assembleia
 * eletrônica e híbrida no art. 1.354-A, incluído pela Lei nº 14.309/2022). Os trechos fixos do
 * template ficam em `TEXTOS` (= `condominio.textosFixos`), cada um com linha própria em
 * `docs/base-legal.md`. O app nunca calcula quórum, maioria nem fração ideal: a fração é texto
 * livre, nunca somada, e nem ela nem a unidade seguem para a IA.
 */

type Dados = Record<string, string>;

const TEXTOS = Object.freeze({
  convocadosEdital: 'convocados por edital de',
  convocadosConvencao: 'convocados na forma da convenção',
  meioEletronico: 'por meio eletrônico, pela plataforma',
  hibrida: 'e, simultaneamente,',
  mesa: 'A mesa foi composta por',
  fechoPresencial: 'que, lida e achada conforme, vai assinada por mim e pelo presidente',
  fechoEletronico: 'Concluída a apuração e divulgado o resultado de todos os votos',
  avisoConvencao:
    'Confira a convenção do condomínio: ela define a forma de convocação e o quórum de cada deliberação (Código Civil, art. 1.334, III) e pode definir quem assina a ata.',
});

/** Natureza no título e no preâmbulo; a opção do formulário acrescenta a sigla. */
const NATUREZA = Object.freeze({ ordinaria: 'Ordinária', extraordinaria: 'Extraordinária' });

/** Busca por valor sem cair em chave do protótipo ("constructor", "toString"…). */
const NATUREZA_POR_VALOR: ReadonlyMap<string, string> = new Map(Object.entries(NATUREZA));

/** Títulos dos grupos de assinatura. */
const GRUPO_MESA = 'Mesa';
const GRUPO_CONDOMINOS = 'Condôminos presentes';

const comLocal = (dados: Dados): boolean =>
  dados.modalidade === 'presencial' || dados.modalidade === 'hibrida';
const comPlataforma = (dados: Dados): boolean =>
  dados.modalidade === 'remota' || dados.modalidade === 'hibrida';

const CAMPOS: CampoDef[] = [
  campoTexto('condominio', 'Condomínio', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o nome do condomínio.',
    ajuda: 'Nome do condomínio, como na convenção.',
  }),
  campoTexto('cnpj', 'CNPJ', { validar: validarCnpj }),
  campoTexto('endereco', 'Endereço', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o endereço do condomínio.',
  }),
  {
    id: 'natureza',
    rotulo: 'Natureza',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'ordinaria', rotulo: `${NATUREZA.ordinaria} (AGO)` },
      { valor: 'extraordinaria', rotulo: `${NATUREZA.extraordinaria} (AGE)` },
    ],
    erroObrigatorio: 'Informe se a assembleia é ordinária ou extraordinária.',
  },
  {
    id: 'chamada',
    rotulo: 'Convocação',
    tipo: 'escolha',
    obrigatorio: false,
    opcoes: [
      { valor: 'primeira', rotulo: 'Primeira convocação' },
      { valor: 'segunda', rotulo: 'Segunda convocação' },
    ],
  },
  { id: 'edital_data', rotulo: 'Data do edital', tipo: 'data', obrigatorio: false },
  CAMPO_DATA,
  CAMPO_INICIO,
  CAMPO_FIM,
  campoModalidade(
    {
      presencial: 'Presencial',
      remota: 'Eletrônica',
      hibrida: 'Híbrida (presencial e eletrônica)',
    },
    'Assembleia eletrônica só se a convenção não a proibir (Código Civil, art. 1.354-A).',
  ),
  campoTexto('local', 'Local', {
    visivelSe: comLocal,
    obrigatorioSe: comLocal,
    erroObrigatorio: 'Informe o local da assembleia.',
  }),
  campoTexto('plataforma', 'Plataforma eletrônica', {
    visivelSe: comPlataforma,
    obrigatorioSe: comPlataforma,
    erroObrigatorio: 'Informe a plataforma eletrônica da assembleia.',
  }),
  campoTexto('presidente', 'Presidente da mesa', {
    obrigatorio: true,
    erroObrigatorio: 'Informe quem presidiu a assembleia.',
  }),
  campoTexto('secretario', 'Secretário(a)', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o(a) secretário(a) da assembleia.',
  }),
  {
    id: 'assinaturas_presentes',
    rotulo: 'Quem assina a ata',
    tipo: 'escolha',
    obrigatorio: false,
    opcoes: [
      { valor: 'mesa', rotulo: 'A mesa (presidente e secretário)' },
      { valor: 'todos', rotulo: 'A mesa e os condôminos presentes' },
    ],
    ajuda: 'Siga o que a convenção exige.',
  },
];

const CAMPOS_PARTICIPANTE: CampoDef[] = [
  campoTexto('unidade', 'Unidade', {
    obrigatorio: true,
    erroObrigatorio: 'Informe a unidade de cada condômino (ex.: Apto 101).',
    peso: 1.5,
  }),
  {
    id: 'vinculo',
    rotulo: 'Vínculo',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'proprietario', rotulo: 'Proprietário(a)' },
      { valor: 'procurador', rotulo: 'Procurador(a)' },
      { valor: 'locatario', rotulo: 'Locatário(a)' },
    ],
    erroObrigatorio:
      'Escolha o vínculo de cada condômino com a unidade (proprietário, procurador ou locatário).',
    enviarParaIA: true,
    peso: 2,
  },
  // Texto livre, como na convenção: nunca somado nem conferido, nunca enviado à IA.
  campoTexto('fracao', 'Fração ideal', { peso: 1.5 }),
];

const SECOES: SecaoDef[] = [
  {
    chave: 'abertura_instalacao',
    titulo: 'Abertura e instalação',
    instrucao:
      'Registre quem abriu os trabalhos e o quórum de instalação como foi declarado na assembleia. Sem declaração, escreva [PREENCHER: quórum de instalação declarado]. Nunca calcule nem deduza o quórum da lista de condôminos. Não repita a data, o local, a convocação nem a composição da mesa: eles vêm do modelo do documento.',
  },
  {
    chave: 'eleicao_mesa',
    titulo: 'Eleição da mesa',
    instrucao:
      'Registre a escolha do presidente e do secretário da mesa somente se ela aconteceu nesta assembleia, como foi dita. Caso contrário, devolva a seção vazia.',
  },
  {
    chave: 'ordem_do_dia',
    titulo: 'Deliberações da ordem do dia',
    instrucao:
      'Para cada item da ordem do dia, na ordem, registre a discussão e o resultado da votação como foi declarado (votos a favor, contra e abstenções, se foram ditos). Sem resultado dito, escreva [PREENCHER: resultado da votação]. Registre a conversão em sessão permanente somente se ela foi dita.',
  },
  {
    chave: 'encerramento',
    titulo: 'Encerramento',
    instrucao:
      'Registre só os comunicados e as manifestações finais feitos antes do encerramento. Não escreva a fórmula de encerramento: ela vem do modelo do documento. Se não houve, devolva a seção vazia.',
  },
];

const REGRAS_PROMPT: string[] = [
  'Esta é a ata de uma assembleia geral de condôminos, regida pelo Código Civil e pela convenção do condomínio. Não cite artigos de lei nem cláusulas da convenção de memória.',
  'Nunca calcule quórum, maioria, fração ideal nem peso de voto: registre só o que foi declarado na assembleia.',
  'Não escreva "aprovado", "rejeitado" nem "por unanimidade" sem que o resultado da votação tenha sido dito na assembleia.',
  'Não declare que a assembleia ou uma deliberação é válida.',
  'Escreva as unidades (apartamento, sala, loja) como aparecem na transcrição, sem completar nem corrigir.',
];

const campo = (id: string): CampoDef | undefined => CAMPOS.find((c) => c.id === id);
const campoParticipante = (id: string): CampoDef | undefined =>
  CAMPOS_PARTICIPANTE.find((c) => c.id === id);

/** "Ordinária"/"Extraordinária" ou `null` se vazia ou inválida. */
const naturezaOuNulo = (dados: Dados): string | null =>
  NATUREZA_POR_VALOR.get(textoLimpo(dados.natureza)) ?? null;

function titulo(dados: Dados): string {
  const natureza = naturezaOuNulo(dados);
  const nome = textoLimpo(dados.condominio);
  const inicio = `Ata da Assembleia Geral${natureza === null ? '' : ` ${natureza}`}`;
  return nome === '' ? inicio : `${inicio} — ${nome}`;
}

function cabecalho(d: EntradaDoDocumento): string[] {
  const nome = textoLimpo(d.dados.condominio);
  const endereco = textoLimpo(d.dados.endereco);
  return [
    ...(nome === '' ? [] : [nome]),
    ...linhaSe('CNPJ', d.dados.cnpj),
    ...(endereco === '' ? [] : [endereco]),
    ...cabecalhoDaReuniao(d.dados, CAMPOS),
  ];
}

/** ", em primeira convocação" ou ", em segunda convocação"; nada se não informada. */
function chamada(dados: Dados): string {
  const rotulo = rotuloDaOpcao(campo('chamada'), textoLimpo(dados.chamada));
  return rotulo === null ? '' : `, em ${rotulo.toLowerCase()}`;
}

/** Onde a assembleia aconteceu, conforme a modalidade (Código Civil, art. 1.354-A). */
function lugar(dados: Dados): string {
  const local = `em ${ou(dados.local, 'local')}`;
  const meio = `${TEXTOS.meioEletronico} ${ou(dados.plataforma, 'plataforma eletrônica')}`;
  switch (dados.modalidade) {
    case 'presencial':
      return local;
    case 'remota':
      return `${meio}, nos termos da convocação`;
    case 'hibrida':
      return `${local} ${TEXTOS.hibrida} ${meio}`;
    default:
      return preencher('modalidade e local da assembleia');
  }
}

/** "convocados por edital de dd/mm/aaaa" com data válida; senão, na forma da convenção. */
function convocacao(dados: Dados): string {
  const edital = dataOuNulo(dados.edital_data);
  return edital === null ? TEXTOS.convocadosConvencao : `${TEXTOS.convocadosEdital} ${edital}`;
}

function preambulo(d: EntradaDoDocumento): string {
  const dados = d.dados;
  const data = dataPorExtensoOuNulo(dados.data) ?? preencher('data da assembleia');
  const hora = horaOuNulo(dados.inicio) ?? preencher('horário de início');
  const natureza = naturezaOuNulo(dados) ?? preencher('natureza da assembleia');
  return [
    `${data}, às ${hora}${chamada(dados)}, ${lugar(dados)}, `,
    `reuniram-se em Assembleia Geral ${natureza} os condôminos do ${ou(dados.condominio, 'nome do condomínio')}, `,
    `situado em ${ou(dados.endereco, 'endereço')}, ${convocacao(dados)}, `,
    'para deliberar sobre a ordem do dia a seguir. ',
    `${TEXTOS.mesa} ${ou(dados.presidente, 'presidente')}, presidente, e ${ou(dados.secretario, 'secretário(a)')}, secretário(a).`,
  ].join('');
}

const assinamTodos = (dados: Dados): boolean => dados.assinaturas_presentes === 'todos';

/** Eletrônica e híbrida: ata lavrada só depois da apuração e da divulgação (art. 1.354-A, § 3º). */
function fecho(d: EntradaDoDocumento): string {
  const dados = d.dados;
  const encerrou = `o presidente encerrou a assembleia${sufixoHora(dados.fim)}`;
  const lavrei = `e eu, ${ou(dados.secretario, 'secretário(a)')}, secretário(a), lavrei a presente ata`;
  const todos = assinamTodos(dados) ? ' e pelos condôminos presentes' : '';
  return comPlataforma(dados)
    ? `${TEXTOS.fechoEletronico}, ${encerrou}, ${lavrei}, em forma eletrônica, que vai assinada por mim e pelo presidente${todos}.`
    : `Nada mais havendo a tratar, ${encerrou}, ${lavrei}, ${TEXTOS.fechoPresencial}${todos}.`;
}

/** "Proprietário(a) — unidade Apto 101" (só o que foi informado e é válido). */
function papelDoCondomino(extras: Dados): string {
  const vinculo = rotuloDaOpcao(campoParticipante('vinculo'), textoLimpo(extras.vinculo));
  const unidade = textoLimpo(extras.unidade);
  return [vinculo, unidade === '' ? null : `unidade ${unidade}`]
    .filter((parte): parte is string => parte !== null)
    .join(' — ');
}

/** Grupo "Mesa" (quem foi informado) e, se a ata pede, os condôminos presentes. */
function assinaturas(d: EntradaDoDocumento): GrupoAssinaturas[] {
  const mesa = [
    { nome: textoLimpo(d.dados.presidente), papel: 'Presidente' },
    { nome: textoLimpo(d.dados.secretario), papel: 'Secretário(a)' },
  ].filter((p) => p.nome !== '');
  const condominos = presentes(d).map((p) => ({
    nome: textoLimpo(p.nome),
    papel: papelDoCondomino(p.extras),
  }));
  return [
    ...(mesa.length > 0 ? [{ titulo: GRUPO_MESA, pessoas: mesa }] : []),
    ...(assinamTodos(d.dados) ? [{ titulo: GRUPO_CONDOMINOS, pessoas: condominos }] : []),
  ];
}

export const condominio: AtaTypeDefinition = {
  id: 'condominio',
  rotulo: 'Condomínio — assembleia geral',
  descricao: 'Assembleia ordinária ou extraordinária de condôminos (Código Civil).',
  campos: CAMPOS,
  camposParticipante: CAMPOS_PARTICIPANTE,
  rotuloPapel: null,
  campoComplemento: 'unidade',
  rotulos: { participantes: 'Condôminos', pauta: 'Ordem do dia' },
  secoes: SECOES,
  temEncaminhamentos: true,
  camposNoPrompt: ['data', 'natureza', 'chamada', 'modalidade', 'presidente', 'secretario'],
  regrasPrompt: REGRAS_PROMPT,
  titulo,
  cabecalho,
  preambulo,
  fecho,
  assinaturas,
  avisosFinais: () => [TEXTOS.avisoConvencao],
  textosFixos: TEXTOS,
};
