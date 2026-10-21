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
import { linhaSe, ou, presentes } from './comum-formal';
import {
  dataPorExtensoOuNulo,
  horaOuNulo,
  preencher,
  rotuloDaOpcao,
  textoLimpo,
} from './texto-modelo';
import type { AtaTypeDefinition, CampoDef, GrupoAssinaturas, SecaoDef } from './types';

/**
 * Ata de reunião da CIPA (NR-5, com a redação da Portaria MTP nº 4.219/2022, e Lei nº 14.457/2022,
 * art. 23). Os trechos fixos do template ficam em `TEXTOS` (= `cipa.textosFixos`), cada um com
 * linha própria em `docs/base-legal.md`; nenhuma cópia literal deles fora daqui.
 */

type Dados = Record<string, string>;

/** Nome da comissão dado pela Lei nº 14.457/2022, art. 23. */
const NOME_DA_COMISSAO = 'Comissão Interna de Prevenção de Acidentes e de Assédio';

const TEXTOS = Object.freeze({
  nomeComissao: `${NOME_DA_COMISSAO} (CIPA)`,
  secretarioDesignado: 'designado(a) pelos membros para redigir esta ata',
  motivoAcidente: 'acidente do trabalho grave ou fatal',
  motivoSolicitacao: 'solicitação de uma das representações',
  localNaOrganizacao: 'nas dependências da organização',
  participacaoRemota: 'com participação remota',
  fechoPresentes:
    'secretário(a) designado(a), lavrei a presente ata, que vai assinada pelos presentes',
  avisoDisponibilizacao:
    'Disponibilize esta ata a todos os integrantes da CIPA (NR-5, item 5.6.3.1) e divulgue as deliberações e os encaminhamentos a todos os empregados, em quadro de aviso ou por meio eletrônico (NR-5, item 5.6.3.2).',
});

/** Primeira letra maiúscula: o rótulo da opção é o mesmo texto fixo que o preâmbulo usa. */
const comMaiuscula = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Texto do preâmbulo para cada motivo de reunião extraordinária (NR-5, 5.6.4). */
const TEXTO_DO_MOTIVO: Readonly<Record<string, string>> = {
  acidente: TEXTOS.motivoAcidente,
  solicitacao: TEXTOS.motivoSolicitacao,
};

const NUMERO_MAXIMO = 999;
const MENSAGEM_NUMERO = 'Use só o número da reunião (ex.: 3).';

/** Número da reunião (inteiro de 1 a `NUMERO_MAXIMO`) normalizado; vazio ou inválido → `null`. */
function numeroOuNulo(valor: string | undefined): string | null {
  const limpo = textoLimpo(valor);
  if (!/^\d+$/.test(limpo)) return null;
  const n = Number(limpo);
  return n >= 1 && n <= NUMERO_MAXIMO ? String(n) : null;
}

const ehExtraordinaria = (dados: Dados): boolean => dados.natureza === 'extraordinaria';

const CAMPOS: CampoDef[] = [
  campoTexto('empresa', 'Empresa', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o nome da empresa.',
  }),
  campoTexto('estabelecimento', 'Estabelecimento'),
  campoTexto('gestao', 'Gestão (mandato)', {
    obrigatorio: true,
    erroObrigatorio: 'Informe a gestão (mandato) da CIPA.',
    ajuda: 'Ex.: 2026/2027.',
  }),
  campoTexto('numero', 'Número da reunião', {
    validar: (valor) => (numeroOuNulo(valor) === null ? MENSAGEM_NUMERO : null),
    teclado: 'numeric',
  }),
  {
    id: 'natureza',
    rotulo: 'Natureza',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'ordinaria', rotulo: 'Ordinária' },
      { valor: 'extraordinaria', rotulo: 'Extraordinária' },
    ],
    erroObrigatorio: 'Informe se a reunião é ordinária ou extraordinária.',
  },
  {
    id: 'motivo',
    rotulo: 'Motivo da reunião extraordinária',
    tipo: 'escolha',
    obrigatorio: false,
    opcoes: Object.entries(TEXTO_DO_MOTIVO).map(([valor, texto]) => ({
      valor,
      rotulo: comMaiuscula(texto),
    })),
    visivelSe: ehExtraordinaria,
    obrigatorioSe: ehExtraordinaria,
    erroObrigatorio: 'Informe o motivo da reunião extraordinária.',
    ajuda: 'NR-5, item 5.6.4.',
  },
  campoTexto('motivo_detalhe', 'Detalhe do motivo', { visivelSe: ehExtraordinaria }),
  CAMPO_DATA,
  CAMPO_INICIO,
  CAMPO_FIM,
  campoModalidade(
    { presencial: 'Presencial', hibrida: `Presencial, ${TEXTOS.participacaoRemota}` },
    'As reuniões ordinárias acontecem na organização; a participação pode ser remota (NR-5, item 5.6.2).',
  ),
  campoTexto('local', 'Local', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o local da reunião.',
  }),
  campoTexto('plataforma', 'Plataforma da participação remota', {
    visivelSe: (dados) => dados.modalidade === 'hibrida',
  }),
  campoTexto('presidente', 'Presidente', {
    obrigatorio: true,
    erroObrigatorio: 'Informe quem presidiu a reunião.',
  }),
  campoTexto('secretario', 'Secretário(a) designado(a)', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o(a) secretário(a) designado(a) para a ata.',
    ajuda: 'Designado(a) pelos membros para redigir a ata (NR-5, item 5.6.5).',
  }),
];

const CAMPOS_PARTICIPANTE: CampoDef[] = [
  {
    id: 'representacao',
    rotulo: 'Representação',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'empregador', rotulo: 'Representante do empregador' },
      { valor: 'empregados', rotulo: 'Representante dos empregados' },
      { valor: 'convidado', rotulo: 'Convidado(a) (não membro)' },
    ],
    erroObrigatorio:
      'Escolha a representação de cada participante (empregador, empregados ou convidado).',
    enviarParaIA: true,
    peso: 2,
  },
  {
    id: 'condicao',
    rotulo: 'Condição',
    tipo: 'escolha',
    obrigatorio: false,
    opcoes: [
      { valor: 'titular', rotulo: 'Titular' },
      { valor: 'suplente', rotulo: 'Suplente' },
    ],
    enviarParaIA: true,
    peso: 1.5,
  },
];

const SECOES: SecaoDef[] = [
  {
    chave: 'abertura',
    titulo: 'Abertura',
    instrucao:
      'Registre quem abriu os trabalhos e, na reunião extraordinária, o motivo da convocação como foi exposto na reunião. Não repita a data, o local nem a lista de presentes: eles vêm do modelo do documento.',
  },
  {
    chave: 'ata_anterior',
    titulo: 'Leitura da ata anterior',
    instrucao:
      'Registre a leitura da ata da reunião anterior, as correções pedidas e a aprovação somente se isso aconteceu nesta reunião. Caso contrário, devolva a seção vazia.',
  },
  {
    chave: 'pendencias_anteriores',
    titulo: 'Acompanhamento das pendências anteriores',
    instrucao:
      'Registre a situação das ações de reuniões anteriores que foram mencionadas, como foi dita (concluída, em andamento, atrasada). Se nenhuma foi mencionada, devolva a seção vazia.',
  },
  {
    chave: 'discussao',
    titulo: 'Assuntos tratados',
    instrucao:
      'Siga a ordem dos itens da pauta e, dentro deles, registre nesta ordem o que foi tratado: acidentes e doenças relacionadas ao trabalho e a análise deles; riscos e inspeções dos ambientes de trabalho; plano de trabalho da comissão; SIPAT; prevenção e combate ao assédio e a outras formas de violência no trabalho; e os demais assuntos que a conversa trouxer. Vacância de cargo ou perda de mandato entra com os motivos como foram ditos.',
  },
  {
    chave: 'deliberacoes',
    titulo: 'Deliberações',
    instrucao:
      'Liste cada deliberação com a forma como foi tomada, por consenso ou por votação, conforme foi dito na reunião, e com o resultado da votação se ele foi dito. Sem a forma dita, escreva [PREENCHER: forma de deliberação] no lugar. Se nada foi deliberado, devolva a seção vazia.',
  },
  {
    chave: 'encerramento',
    titulo: 'Encerramento',
    instrucao:
      'Registre só os comunicados e as manifestações finais feitos antes do encerramento. Não escreva a fórmula de encerramento: ela vem do modelo do documento. Se não houve, devolva a seção vazia.',
  },
];

const REGRAS_PROMPT: string[] = [
  `Esta é a ata de uma reunião da ${TEXTOS.nomeComissao}, regida pela Norma Regulamentadora nº 5 (NR-5). Não cite itens da norma nem artigos de lei de memória.`,
  'Registre uma deliberação como tomada por consenso ou por votação somente se isso foi dito na reunião. Votação sem resultado dito: escreva [PREENCHER: resultado da votação].',
  'Não escreva diagnóstico, CID, afastamento nem outra informação de saúde de pessoa identificada. Registre o acidente, a análise feita e as medidas adotadas ou propostas.',
  'Em relato de assédio ou de outra violência no trabalho, não escreva o nome da pessoa que denunciou nem o da vítima: registre o tema, as medidas e os encaminhamentos. Esta regra prevalece sobre a de usar os nomes exatamente como aparecem.',
  'Não declare que a reunião é válida nem que houve quórum.',
  'Use a representação de cada participante informada na lista (representante do empregador, representante dos empregados ou convidado) para atribuir as posições.',
];

const campo = (id: string): CampoDef | undefined => CAMPOS.find((c) => c.id === id);

/** Rótulo da natureza ("Ordinária"/"Extraordinária") ou `null` se vazia ou inválida. */
const naturezaOuNulo = (dados: Dados): string | null =>
  rotuloDaOpcao(campo('natureza'), textoLimpo(dados.natureza));

function titulo(dados: Dados): string {
  const numero = numeroOuNulo(dados.numero);
  const natureza = naturezaOuNulo(dados);
  const empresa = textoLimpo(dados.empresa);
  const reuniao = [`Reunião${natureza === null ? '' : ` ${natureza}`}`, 'da CIPA'].join(' ');
  const inicio = numero === null ? `Ata de ${reuniao}` : `Ata da ${numero}ª ${reuniao}`;
  return empresa === '' ? inicio : `${inicio} — ${empresa}`;
}

function cabecalho(d: EntradaDoDocumento): string[] {
  const empresa = textoLimpo(d.dados.empresa);
  return [
    ...(empresa === '' ? [] : [empresa]),
    ...linhaSe('Estabelecimento', d.dados.estabelecimento),
    ...linhaSe('Gestão', d.dados.gestao),
    ...cabecalhoDaReuniao(d.dados, CAMPOS),
  ];
}

/** ", com participação remota[ por meio de X]" na híbrida; nada na presencial. */
function participacao(dados: Dados): string {
  switch (dados.modalidade) {
    case 'presencial':
      return '';
    case 'hibrida': {
      const plataforma = textoLimpo(dados.plataforma);
      return `, ${TEXTOS.participacaoRemota}${plataforma === '' ? '' : ` por meio de ${plataforma}`}`;
    }
    default:
      return `, na modalidade ${preencher('modalidade')}`;
  }
}

/** ", convocada em razão de …[: detalhe]" só se a natureza ATUAL é extraordinária. */
function convocacao(dados: Dados): string {
  if (!ehExtraordinaria(dados)) return '';
  const motivo =
    TEXTO_DO_MOTIVO[textoLimpo(dados.motivo)] ?? preencher('motivo da reunião extraordinária');
  const detalhe = textoLimpo(dados.motivo_detalhe);
  return `, convocada em razão de ${motivo}${detalhe === '' ? '' : `: ${detalhe}`}`;
}

function preambulo(d: EntradaDoDocumento): string {
  const dados = d.dados;
  const data = dataPorExtensoOuNulo(dados.data) ?? preencher('data da reunião');
  const hora = horaOuNulo(dados.inicio) ?? preencher('horário de início');
  const numero = numeroOuNulo(dados.numero);
  const natureza = naturezaOuNulo(dados)?.toLowerCase() ?? preencher('natureza da reunião');
  const reuniao = numero === null ? `reunião ${natureza}` : `a ${numero}ª reunião ${natureza}`;
  const estabelecimento = textoLimpo(dados.estabelecimento);

  return [
    `${data}, às ${hora}, ${TEXTOS.localNaOrganizacao}, em ${ou(dados.local, 'local')}${participacao(dados)}, `,
    `realizou-se ${reuniao} da ${TEXTOS.nomeComissao} de ${ou(dados.empresa, 'empresa')}`,
    estabelecimento === '' ? '' : `, estabelecimento ${estabelecimento}`,
    `, gestão ${ou(dados.gestao, 'gestão')}${convocacao(dados)}, `,
    `presidida por ${ou(dados.presidente, 'presidente')} e secretariada por ${ou(dados.secretario, 'secretário(a)')}, ${TEXTOS.secretarioDesignado}. `,
    'Estiveram presentes os membros e convidados relacionados a seguir.',
  ].join('');
}

function fecho(d: EntradaDoDocumento): string {
  const secretario = ou(d.dados.secretario, 'secretário(a)');
  return `Nada mais havendo a tratar, a reunião foi encerrada${sufixoHora(d.dados.fim)}. E, para constar, eu, ${secretario}, ${TEXTOS.fechoPresentes}.`;
}

const campoParticipante = (id: string): CampoDef | undefined =>
  CAMPOS_PARTICIPANTE.find((c) => c.id === id);

/** Todos os presentes assinam (NR-5, 5.6.3): papel = representação — condição, ou o cargo. */
function assinaturas(d: EntradaDoDocumento): GrupoAssinaturas[] {
  const pessoas = presentes(d).map((p) => {
    const qualificacao = [
      rotuloDaOpcao(campoParticipante('representacao'), textoLimpo(p.extras.representacao)),
      rotuloDaOpcao(campoParticipante('condicao'), textoLimpo(p.extras.condicao)),
    ]
      .filter((r): r is string => r !== null)
      .join(' — ');
    return { nome: textoLimpo(p.nome), papel: qualificacao || textoLimpo(p.papel) };
  });
  return [{ titulo: null, pessoas }];
}

export const cipa: AtaTypeDefinition = {
  id: 'cipa',
  rotulo: 'CIPA — reunião ordinária ou extraordinária',
  descricao: `${NOME_DA_COMISSAO} (NR-5).`,
  campos: CAMPOS,
  camposParticipante: CAMPOS_PARTICIPANTE,
  rotuloPapel: 'Cargo / função',
  rotulos: { participantes: 'Participantes', pauta: 'Pauta' },
  secoes: SECOES,
  temEncaminhamentos: true,
  camposNoPrompt: ['data', 'natureza', 'motivo', 'modalidade', 'presidente', 'secretario'],
  regrasPrompt: REGRAS_PROMPT,
  titulo,
  cabecalho,
  preambulo,
  fecho,
  assinaturas,
  avisosFinais: () => [TEXTOS.avisoDisponibilizacao],
  textosFixos: TEXTOS,
};
