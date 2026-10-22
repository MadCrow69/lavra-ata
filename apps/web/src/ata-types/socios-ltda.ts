import type { AtaDraft, EntradaDoDocumento } from '../domain/draft';
import {
  CAMPO_DATA,
  CAMPO_FIM,
  CAMPO_INICIO,
  cabecalhoDaReuniao,
  campoModalidade,
  campoTexto,
  sufixoHora,
} from './campos-comuns';
import {
  CEM_POR_CENTO,
  formatarPercentual,
  formatarQuotas,
  lerPercentual,
  lerQuotas,
  modoCapital,
  resumirCapital,
  textoCapitalPresente,
  type ResumoCapital,
} from './capital';
import { linhaSe, listados, ou, presentes, validarCnpj } from './comum-formal';
import {
  dataPorExtensoOuNulo,
  horaOuNulo,
  preencher,
  rotuloDaOpcao,
  textoLimpo,
} from './texto-modelo';
import type {
  AtaTypeDefinition,
  CampoDef,
  GrupoAssinaturas,
  ResumoParticipantes,
  SecaoDef,
} from './types';

/**
 * Ata de reunião ou assembleia de sócios de sociedade limitada (Código Civil, arts. 1.072 a
 * 1.080-A e 1.152, § 3º; Manual de Registro de Sociedade Limitada do DREI, Anexo IV da IN DREI nº
 * 81/2020). Os trechos fixos do template ficam em `TEXTOS` (= `sociosLtda.textosFixos`), cada um
 * com linha própria em `docs/base-legal.md`. O app nunca calcula quórum, maioria nem validade: o
 * capital presente é só a soma das participações informadas (`capital.ts`), e a participação
 * nunca segue para a IA.
 */

type Dados = Record<string, string>;

const TEXTOS = Object.freeze({
  localDigital: 'de forma digital, considerada realizada na sede da sociedade, por meio de',
  localSemipresencial: 'de forma semipresencial, em',
  capitalPresenteAbertura: 'Estiveram presentes ou representados sócios titulares de',
  capitalPresente: 'do capital social, conforme as participações informadas na relação a seguir.',
  mesa: 'Composição da mesa:',
  convocacaoPresencaTodos:
    'Dispensadas as formalidades de convocação, nos termos do art. 1.072, § 2º, do Código Civil, em razão do comparecimento de todos os sócios.',
  convocacaoCienciaEscrita:
    'Dispensadas as formalidades de convocação, nos termos do art. 1.072, § 2º, do Código Civil, por terem todos os sócios declarado, por escrito, ciência do local, da data, da hora e da ordem do dia.',
  convocacaoContrato: 'Convocação realizada na forma do contrato social:',
  convocacaoEdital: 'Convocação por edital publicado em',
  convocacaoEditalNorma: ', nos termos do art. 1.152, § 3º, do Código Civil.',
  participacaoDistancia: 'com participação e votação a distância mediante',
  participacaoDistanciaNorma: ', nos termos do art. 1.080-A do Código Civil.',
  declaracaoFormalidades: 'A mesa declarou atendidas as formalidades legais para a realização da',
  fechoComPresentes:
    'da qual se lavrou a presente ata, que, lida e achada conforme, vai assinada pelos membros da mesa e pelos sócios presentes. Sócios presentes:',
  avisoArquivamento:
    'Arquivamento: apresente cópia desta ata à Junta Comercial nos 20 dias seguintes à',
  avisoArquivamentoNorma:
    '(Código Civil, art. 1.075, § 2º). Peça a conferência de um profissional (advogado ou contador) antes de assinar e registrar.',
  avisoProcuracao:
    'Representação por procurador: o procurador deve ser outro sócio ou advogado, e o mandato deve especificar os atos autorizados e acompanhar a ata no registro, salvo disposição diversa do contrato social (Código Civil, art. 1.074, § 1º; Manual de Registro de Sociedade Limitada do DREI).',
});

/** Forma no título ("Reunião"/"Assembleia"); no texto corrido, em minúsculas. */
const FORMA = Object.freeze({ reuniao: 'Reunião', assembleia: 'Assembleia' });

/** Busca por valor sem cair em chave do protótipo ("constructor", "toString"…). */
const FORMA_POR_VALOR: ReadonlyMap<string, string> = new Map(Object.entries(FORMA));

/** Títulos dos grupos de assinatura. */
const GRUPO_MESA = 'Mesa';
const GRUPO_SOCIOS = 'Sócios presentes';

/** Código Civil, art. 1.072, § 1º: acima deste número de sócios, a deliberação é em assembleia. */
const MAXIMO_SOCIOS_EM_REUNIAO = 10;

const DIGITOS_NIRE = 11;
const MENSAGEM_NIRE = 'O NIRE tem 11 dígitos.';
const MENSAGEM_QUOTAS = 'Use um número inteiro de quotas (ex.: 1.000).';
const MENSAGEM_PERCENTUAL =
  'Use um percentual de 0 a 100, com até duas casas decimais (ex.: 33,33).';

const comLocal = (dados: Dados): boolean =>
  dados.modalidade === 'presencial' || dados.modalidade === 'hibrida';
const aDistancia = (dados: Dados): boolean =>
  dados.modalidade === 'remota' || dados.modalidade === 'hibrida';
const comDetalheDaConvocacao = (dados: Dados): boolean =>
  dados.convocacao === 'contrato' || dados.convocacao === 'edital';
const emQuotas = (dados: Dados): boolean => modoCapital(dados) === 'quotas';

const CAMPOS: CampoDef[] = [
  campoTexto('razao_social', 'Nome empresarial', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o nome empresarial da sociedade.',
  }),
  campoTexto('cnpj', 'CNPJ', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o CNPJ da sociedade.',
    validar: validarCnpj,
  }),
  campoTexto('nire', 'NIRE', {
    validar: (valor) => (valor.replace(/\D/g, '').length === DIGITOS_NIRE ? null : MENSAGEM_NIRE),
    teclado: 'numeric',
  }),
  campoTexto('sede', 'Endereço da sede', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o endereço da sede.',
  }),
  {
    id: 'forma',
    rotulo: 'Forma',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'reuniao', rotulo: `${FORMA.reuniao} de sócios` },
      { valor: 'assembleia', rotulo: `${FORMA.assembleia} de sócios` },
    ],
    erroObrigatorio: 'Informe se é reunião ou assembleia de sócios.',
  },
  CAMPO_DATA,
  CAMPO_INICIO,
  CAMPO_FIM,
  campoModalidade({ presencial: 'Presencial', remota: 'Digital', hibrida: 'Semipresencial' }),
  campoTexto('local', 'Local', {
    visivelSe: comLocal,
    obrigatorioSe: comLocal,
    erroObrigatorio: 'Informe o local da reunião ou assembleia.',
  }),
  campoTexto('plataforma', 'Sistema eletrônico', {
    visivelSe: aDistancia,
    obrigatorioSe: aDistancia,
    erroObrigatorio: 'Informe o sistema eletrônico usado.',
  }),
  {
    id: 'participacao_distancia',
    rotulo: 'Participação e voto a distância',
    tipo: 'escolha',
    obrigatorio: false,
    opcoes: [
      { valor: 'sistema', rotulo: 'Atuação remota por sistema eletrônico' },
      { valor: 'boletim', rotulo: 'Boletim de voto a distância' },
      { valor: 'ambos', rotulo: 'Sistema eletrônico e boletim de voto a distância' },
    ],
    visivelSe: aDistancia,
    obrigatorioSe: aDistancia,
    erroObrigatorio: 'Informe como os sócios participaram e votaram a distância.',
  },
  {
    id: 'convocacao',
    rotulo: 'Convocação',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'presenca_todos', rotulo: 'Dispensada: todos os sócios presentes' },
      { valor: 'ciencia_escrita', rotulo: 'Dispensada: todos declararam ciência por escrito' },
      { valor: 'contrato', rotulo: 'Na forma do contrato social' },
      { valor: 'edital', rotulo: 'Edital publicado' },
    ],
    erroObrigatorio: 'Informe como os sócios foram convocados.',
  },
  campoTexto('convocacao_detalhe', 'Detalhe da convocação', {
    visivelSe: comDetalheDaConvocacao,
    obrigatorioSe: comDetalheDaConvocacao,
    rotuloPor: (dados) =>
      dados.convocacao === 'edital'
        ? 'Veículos e datas das publicações'
        : 'Meio e data da convocação',
  }),
  campoTexto('presidente', 'Presidente', {
    obrigatorio: true,
    erroObrigatorio: 'Informe quem presidiu a reunião ou assembleia.',
  }),
  campoTexto('secretario', 'Secretário(a)', {
    obrigatorio: true,
    erroObrigatorio: 'Informe o(a) secretário(a) da reunião ou assembleia.',
  }),
  {
    id: 'modo_capital',
    rotulo: 'Participação informada em',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'percentual', rotulo: 'Percentual (%)' },
      { valor: 'quotas', rotulo: 'Quotas' },
    ],
    erroObrigatorio: 'Informe se a participação dos sócios é em percentual ou em quotas.',
  },
  campoTexto('total_quotas', 'Total de quotas do capital', {
    visivelSe: emQuotas,
    obrigatorioSe: emQuotas,
    erroObrigatorio: 'Informe o total de quotas do capital social.',
    validar: (valor) => (lerQuotas(valor) === null ? MENSAGEM_QUOTAS : null),
    teclado: 'numeric',
  }),
  {
    id: 'declaracao_formalidades',
    rotulo: 'Declaração de formalidades',
    tipo: 'escolha',
    obrigatorio: false,
    opcoes: [{ valor: 'sim', rotulo: 'A mesa declara atendidas as formalidades legais' }],
    ajuda: 'Exigida para o registro (Manual DREI). Sem ela, a ata sai com [PREENCHER].',
  },
];

const CAMPOS_PARTICIPANTE: CampoDef[] = [
  // Nunca segue para a IA (sem `enviarParaIA`): só a soma dos presentes sai no documento.
  campoTexto('participacao', 'Participação (%)', {
    obrigatorio: true,
    erroObrigatorio: 'Informe a participação de cada sócio no capital, inclusive dos ausentes.',
    rotuloPor: (dados) => (emQuotas(dados) ? 'Quotas' : 'Participação (%)'),
    validar: (valor, dados) =>
      emQuotas(dados)
        ? lerQuotas(valor) === null
          ? MENSAGEM_QUOTAS
          : null
        : lerPercentual(valor) === null
          ? MENSAGEM_PERCENTUAL
          : null,
    teclado: 'decimal',
    peso: 2,
  }),
  campoTexto('procurador', 'Representado(a) por', { enviarParaIA: true, peso: 2.5 }),
];

const SECOES: SecaoDef[] = [
  {
    chave: 'instalacao',
    titulo: 'Instalação',
    instrucao:
      'Registre a abertura dos trabalhos e o quórum de instalação como foi declarado. Sem declaração, escreva [PREENCHER: quórum de instalação]. Nunca calcule nem deduza o quórum das participações ou da lista de sócios. Não repita a data, o local, a convocação nem a composição da mesa: eles vêm do modelo do documento.',
  },
  {
    chave: 'deliberacoes',
    titulo: 'Deliberações',
    instrucao:
      'Para cada item da ordem do dia, na ordem, registre a matéria, os votos como foram declarados (inclusive dissidências, abstenções e impedimentos de voto) e o quórum de aprovação somente se ele foi dito. Sem os votos ditos, escreva [PREENCHER: votos e quórum de aprovação].',
  },
  {
    chave: 'encerramento',
    titulo: 'Encerramento',
    instrucao:
      'Registre só os comunicados e as manifestações finais feitos antes do encerramento. Não escreva a fórmula de encerramento: ela vem do modelo do documento. Se não houve, devolva a seção vazia.',
  },
];

const REGRAS_PROMPT: string[] = [
  'Esta é a ata de uma deliberação dos sócios de uma sociedade limitada, em reunião ou assembleia, regida pelo Código Civil e pelo contrato social.',
  'Não calcule quórum nem percentuais de capital. Não escreva "totalidade do capital", "maioria" nem "unanimidade" sem que isso tenha sido dito na reunião ou assembleia.',
  'Não cite quórum legal nem artigo de lei de memória: a lei mudou e o contrato social pode dispor de outra forma. Registre só o quórum que foi declarado.',
  'Registre dissidência, abstenção e impedimento de voto somente como foram declarados.',
  'As formalidades de convocação vêm do modelo do documento: não as descreva.',
];

const campo = (id: string): CampoDef | undefined => CAMPOS.find((c) => c.id === id);

/** "Reunião"/"Assembleia" ou `null` se vazia ou inválida. */
const formaOuNulo = (dados: Dados): string | null =>
  FORMA_POR_VALOR.get(textoLimpo(dados.forma)) ?? null;

/** "reunião"/"assembleia" no texto corrido, ou a lacuna. */
const formaNoTexto = (dados: Dados): string =>
  formaOuNulo(dados)?.toLowerCase() ?? preencher('reunião ou assembleia');

function titulo(dados: Dados): string {
  const forma = formaOuNulo(dados);
  const nome = textoLimpo(dados.razao_social);
  const inicio = `Ata de ${forma ?? 'Reunião ou Assembleia'} de Sócios`;
  return nome === '' ? inicio : `${inicio} — ${nome}`;
}

function cabecalho(d: EntradaDoDocumento): string[] {
  const nome = textoLimpo(d.dados.razao_social);
  return [
    ...(nome === '' ? [] : [nome]),
    ...linhaSe('CNPJ', d.dados.cnpj),
    ...linhaSe('NIRE', d.dados.nire),
    ...linhaSe('Sede', d.dados.sede),
    ...cabecalhoDaReuniao(d.dados, CAMPOS),
  ];
}

/** Onde a reunião aconteceu, conforme a modalidade (Manual DREI, Seção III). */
function lugar(dados: Dados): string {
  const local = ou(dados.local, 'local');
  const sistema = ou(dados.plataforma, 'sistema eletrônico');
  switch (dados.modalidade) {
    case 'presencial':
      return `em ${local}`;
    case 'remota':
      return `${TEXTOS.localDigital} ${sistema}`;
    case 'hibrida':
      return `${TEXTOS.localSemipresencial} ${local} e por meio de ${sistema}`;
    default:
      return preencher('modalidade e local');
  }
}

function convocacao(dados: Dados): string {
  const detalhe = (lacuna: string) => ou(dados.convocacao_detalhe, lacuna);
  switch (dados.convocacao) {
    case 'presenca_todos':
      return TEXTOS.convocacaoPresencaTodos;
    case 'ciencia_escrita':
      return TEXTOS.convocacaoCienciaEscrita;
    case 'contrato':
      return `${TEXTOS.convocacaoContrato} ${detalhe('meio e data da convocação')}.`;
    case 'edital':
      return `${TEXTOS.convocacaoEdital} ${detalhe('veículos e datas das publicações')}${TEXTOS.convocacaoEditalNorma}`;
    default:
      return preencher('forma de convocação');
  }
}

/** Digital e semipresencial: a ata informa a forma de participação e voto a distância. */
function participacaoADistancia(dados: Dados): string | null {
  if (!aDistancia(dados)) return null;
  const modalidade = rotuloDaOpcao(campo('modalidade'), dados.modalidade)?.toLowerCase() ?? '';
  const forma =
    rotuloDaOpcao(
      campo('participacao_distancia'),
      textoLimpo(dados.participacao_distancia),
    )?.toLowerCase() ?? preencher('forma de participação e voto a distância');
  return `A ${formaNoTexto(dados)} foi realizada de forma ${modalidade}, ${TEXTOS.participacaoDistancia} ${forma}${TEXTOS.participacaoDistanciaNorma}`;
}

function preambulo(d: EntradaDoDocumento): string {
  const dados = d.dados;
  const data = dataPorExtensoOuNulo(dados.data) ?? preencher('data');
  const hora = horaOuNulo(dados.inicio) ?? preencher('horário de início');
  const nire = textoLimpo(dados.nire);
  const capital =
    textoCapitalPresente(resumirCapital(dados, d.participantes)) ??
    preencher('capital social representado pelos presentes');
  const declaracao =
    dados.declaracao_formalidades === 'sim'
      ? `${TEXTOS.declaracaoFormalidades} ${formaNoTexto(dados)}.`
      : preencher('declaração da mesa de que foram atendidas as formalidades legais');

  return [
    `${data}, às ${hora}, ${lugar(dados)}, reuniram-se em ${formaNoTexto(dados)} os sócios de ${ou(dados.razao_social, 'nome empresarial')}, ` +
      `inscrita no CNPJ sob o nº ${ou(dados.cnpj, 'CNPJ')}${nire === '' ? '' : `, NIRE ${nire}`}, com sede em ${ou(dados.sede, 'endereço da sede')}.`,
    `${TEXTOS.capitalPresenteAbertura} ${capital} ${TEXTOS.capitalPresente}`,
    `${TEXTOS.mesa} ${ou(dados.presidente, 'presidente')}, presidente, e ${ou(dados.secretario, 'secretário(a)')}, secretário(a).`,
    convocacao(dados),
    participacaoADistancia(dados),
    declaracao,
  ]
    .filter((p): p is string => p !== null)
    .join(' ');
}

const procuradorDe = (extras: Dados): string => textoLimpo(extras.procurador);

/** Fecho com o nome dos presentes (Manual DREI, Seção II, item 4, VIII). */
function fecho(d: EntradaDoDocumento): string {
  const nomes = presentes(d).map((p) => {
    const procurador = procuradorDe(p.extras);
    const nome = textoLimpo(p.nome);
    return procurador === '' ? nome : `${nome}, representado(a) por ${procurador}`;
  });
  const lista = nomes.length === 0 ? preencher('sócios presentes') : nomes.join('; ');
  return `Nada mais havendo a tratar, foi encerrada a ${formaNoTexto(d.dados)}${sufixoHora(d.dados.fim)}, ${TEXTOS.fechoComPresentes} ${lista}.`;
}

/** Grupo "Mesa" (quem foi informado) e os sócios presentes; o procurador assina pelo sócio. */
function assinaturas(d: EntradaDoDocumento): GrupoAssinaturas[] {
  const mesa = [
    { nome: textoLimpo(d.dados.presidente), papel: 'Presidente' },
    { nome: textoLimpo(d.dados.secretario), papel: 'Secretário(a)' },
  ].filter((p) => p.nome !== '');
  const socios = presentes(d).map((p) => {
    const procurador = procuradorDe(p.extras);
    const nome = textoLimpo(p.nome);
    return procurador === ''
      ? { nome, papel: 'Sócio(a)' }
      : { nome: procurador, papel: `Procurador(a) de ${nome}` };
  });
  return [
    ...(mesa.length > 0 ? [{ titulo: GRUPO_MESA, pessoas: mesa }] : []),
    ...(socios.length > 0 ? [{ titulo: GRUPO_SOCIOS, pessoas: socios }] : []),
  ];
}

function avisosFinais(d: EntradaDoDocumento): string[] {
  const forma = formaOuNulo(d.dados)?.toLowerCase() ?? 'reunião ou assembleia';
  const arquivamento = `${TEXTOS.avisoArquivamento} ${forma} ${TEXTOS.avisoArquivamentoNorma}`;
  const comProcurador = presentes(d).some((p) => procuradorDe(p.extras) !== '');
  return [arquivamento, ...(comProcurador ? [TEXTOS.avisoProcuracao] : [])];
}

/** "110%" ou "1.100 quotas": a soma de todos no modo do formulário. */
function somaFormatada(r: ResumoCapital, soma: number): string {
  return r.modo === 'percentual' ? formatarPercentual(soma) : `${formatarQuotas(soma)} quotas`;
}

/** Alertas da soma das participações (só avisam; nunca bloqueiam a geração). */
function alertasDaSoma(r: ResumoCapital): string[] {
  const limite = r.modo === 'percentual' ? CEM_POR_CENTO : r.totalQuotas;
  if (r.somaTodos === null || limite === null) return [];
  const soma = somaFormatada(r, r.somaTodos);
  if (r.somaTodos > limite) {
    const acima =
      r.modo === 'percentual' ? 'de 100%' : `do total de ${formatarQuotas(limite)} quotas`;
    return [
      `As participações informadas somam ${soma}, acima ${acima}. Corrija: a ata sai com [PREENCHER] no capital presente.`,
    ];
  }
  if (r.somaTodos < limite) {
    return [
      `As participações informadas somam ${soma}. Se faltam sócios na lista, inclua-os (inclusive os ausentes).`,
    ];
  }
  return [];
}

function resumoDosParticipantes(d: Pick<AtaDraft, 'dados' | 'participantes'>): ResumoParticipantes {
  const r = resumirCapital(d.dados, d.participantes);
  const capital = textoCapitalPresente(r);
  const socios = listados(d);
  const naoPresentes = socios.filter((p) => p.presenca !== 'presente').length;
  const alertas = [...alertasDaSoma(r)];
  if (d.dados.convocacao === 'presenca_todos' && naoPresentes > 0) {
    alertas.push(
      naoPresentes === 1
        ? 'Você indicou que todos os sócios compareceram, mas 1 sócio está marcado como ausente.'
        : `Você indicou que todos os sócios compareceram, mas ${String(naoPresentes)} sócios estão marcados como ausentes.`,
    );
  }
  if (d.dados.forma === 'reuniao' && socios.length > MAXIMO_SOCIOS_EM_REUNIAO) {
    alertas.push(
      `A lista tem ${String(socios.length)} sócios: com mais de dez, o Código Civil exige assembleia (art. 1.072, § 1º). Confira a forma escolhida.`,
    );
  }
  return { texto: capital === null ? null : `Capital presente informado: ${capital}`, alertas };
}

export const sociosLtda: AtaTypeDefinition = {
  id: 'socios-ltda',
  rotulo: 'Sócios de Ltda — reunião ou assembleia',
  descricao: 'Deliberação dos sócios de sociedade limitada (Código Civil e DREI).',
  campos: CAMPOS,
  camposParticipante: CAMPOS_PARTICIPANTE,
  rotuloPapel: null,
  campoComplemento: 'participacao',
  rotulos: { participantes: 'Sócios', pauta: 'Ordem do dia' },
  secoes: SECOES,
  temEncaminhamentos: true,
  camposNoPrompt: ['data', 'forma', 'modalidade', 'convocacao', 'presidente', 'secretario'],
  regrasPrompt: REGRAS_PROMPT,
  titulo,
  cabecalho,
  preambulo,
  fecho,
  assinaturas,
  avisosFinais,
  resumoDosParticipantes,
  textosFixos: TEXTOS,
};
