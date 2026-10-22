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
import type { AtaTypeDefinition, CampoDef, GrupoAssinaturas, SecaoDef } from './types';
import { dataPorExtensoOuNulo, horaOuNulo, preencher, textoLimpo } from './texto-modelo';

type Dados = Record<string, string>;

function exigeLocal(dados: Dados): boolean {
  return dados.modalidade === 'presencial' || dados.modalidade === 'hibrida';
}

const CAMPOS: CampoDef[] = [
  {
    id: 'organizacao',
    rotulo: 'Organização',
    tipo: 'texto',
    obrigatorio: true,
    erroObrigatorio: 'Informe o nome da organização.',
    ajuda: 'Empresa, órgão ou grupo que realizou a reunião.',
  },
  {
    id: 'assunto',
    rotulo: 'Assunto',
    tipo: 'texto',
    obrigatorio: true,
    erroObrigatorio: 'Informe o assunto da reunião.',
    ajuda: 'Vira o título da ata.',
  },
  CAMPO_DATA,
  CAMPO_INICIO,
  CAMPO_FIM,
  campoModalidade({ presencial: 'Presencial', remota: 'Remota', hibrida: 'Híbrida' }),
  // Exceção conhecida (D2): aqui `local` guarda a plataforma na reunião remota.
  campoTexto('local', 'Local', {
    rotuloPor: (dados) => (dados.modalidade === 'remota' ? 'Plataforma' : 'Local'),
    obrigatorioSe: exigeLocal,
    erroObrigatorio: 'Informe o local da reunião.',
    ajuda: 'Endereço ou sala; na reunião remota, a plataforma usada.',
    visivelSe: (dados) => dados.modalidade !== undefined && dados.modalidade !== '',
  }),
  {
    id: 'conducao',
    rotulo: 'Condução',
    tipo: 'texto',
    obrigatorio: false,
    ajuda: 'Quem presidiu ou coordenou a reunião.',
  },
  {
    id: 'redacao',
    rotulo: 'Redator(a)',
    tipo: 'texto',
    obrigatorio: false,
    ajuda: 'Quem redige a ata.',
  },
];

const SECOES: SecaoDef[] = [
  {
    chave: 'resumo',
    titulo: 'Resumo',
    instrucao:
      'Resuma em um ou dois parágrafos o objetivo da reunião e os pontos principais tratados, sem repetir o detalhe das demais seções.',
  },
  {
    chave: 'discussao',
    titulo: 'Discussão por item de pauta',
    instrucao:
      'Para cada item da pauta, na ordem informada, descreva o que foi discutido, quem trouxe cada posição relevante e o encaminhamento natural do assunto. Assuntos tratados fora da pauta entram ao final, em parágrafo próprio.',
  },
  {
    chave: 'decisoes',
    titulo: 'Decisões',
    instrucao:
      'Liste somente as decisões declaradas de forma explícita na reunião. Se nada foi decidido, devolva a seção vazia.',
  },
  {
    chave: 'pendencias',
    titulo: 'Pendências',
    instrucao:
      'Liste os assuntos que ficaram em aberto, incluindo o acompanhamento de pendências de reuniões anteriores, se foram mencionadas. Se não há pendências, devolva a seção vazia.',
  },
  {
    chave: 'riscos',
    titulo: 'Riscos',
    instrucao:
      'Registre riscos ou preocupações apontados pelos participantes. Se ninguém apontou nenhum, devolva a seção vazia.',
  },
  {
    chave: 'proxima_reuniao',
    titulo: 'Próxima reunião',
    instrucao:
      'Informe data, horário, local e pauta da próxima reunião apenas se foram mencionados. Caso contrário, devolva a seção vazia.',
  },
];

const REGRAS_PROMPT: string[] = [
  'Trate esta ata como a de uma reunião de trabalho de uma organização: sem fórmulas legais nem invocação de normas.',
  'Na discussão, siga a ordem da pauta informada e atribua posições a quem as expressou, usando os nomes da lista de participantes.',
  'Uma seção sem conteúdo na transcrição deve voltar vazia; nunca a preencha com texto genérico só para não deixá-la em branco.',
  'Riscos só entram se alguém os apontou. Não os deduza da discussão.',
  'Cada encaminhamento tem ação, responsável, prazo e status. Use o status "pendente" quando a transcrição não disser outra coisa.',
  'Não repita nos blocos o preâmbulo, a lista de participantes nem o fecho: esses textos vêm prontos do modelo.',
];

function descreverLocalizacao(dados: Dados): string {
  const local = textoLimpo(dados.local);
  switch (dados.modalidade) {
    case 'presencial':
      return `de forma presencial, em ${local === '' ? preencher('local') : local}`;
    case 'remota':
      return local === '' ? 'de forma remota' : `de forma remota, por meio de ${local}`;
    case 'hibrida':
      return `em formato híbrido, com sede em ${local === '' ? preencher('local') : local}`;
    default:
      return `na modalidade ${preencher('modalidade')}`;
  }
}

function cabecalho(d: EntradaDoDocumento): string[] {
  const organizacao = textoLimpo(d.dados.organizacao);
  return [...(organizacao === '' ? [] : [organizacao]), ...cabecalhoDaReuniao(d.dados, CAMPOS)];
}

function preambulo(d: EntradaDoDocumento): string {
  const dados = d.dados;
  const data = dataPorExtensoOuNulo(dados.data) ?? preencher('data da reunião');
  const hora = horaOuNulo(dados.inicio) ?? preencher('horário de início');
  const organizacao = textoLimpo(dados.organizacao) || preencher('organização');
  const assunto = textoLimpo(dados.assunto) || preencher('assunto');
  const conducao = textoLimpo(dados.conducao);
  const redacao = textoLimpo(dados.redacao);

  const partes = [
    `${data}, às ${hora}, ${descreverLocalizacao(dados)}, realizou-se reunião de ${organizacao}, com o assunto “${assunto}”.`,
  ];
  if (conducao !== '') partes.push(`A reunião foi conduzida por ${conducao}.`);
  if (redacao !== '') partes.push(`A ata foi redigida por ${redacao}.`);
  partes.push('Participaram as pessoas relacionadas a seguir.');
  return partes.join(' ');
}

function fecho(d: EntradaDoDocumento): string {
  return `Nada mais havendo a tratar, a reunião foi encerrada${sufixoHora(d.dados.fim)}. E, para constar, foi lavrada a presente ata.`;
}

function assinaturas(d: EntradaDoDocumento): GrupoAssinaturas[] {
  const candidatas = [
    { nome: textoLimpo(d.dados.conducao), papel: 'Condução' },
    { nome: textoLimpo(d.dados.redacao), papel: 'Redação' },
  ];
  const pessoas = candidatas.filter((a) => a.nome !== '');
  return pessoas.length === 0 ? [] : [{ titulo: null, pessoas }];
}

export const corporativa: AtaTypeDefinition = {
  id: 'corporativa',
  rotulo: 'Reunião corporativa',
  descricao: 'Reunião de trabalho de uma empresa, equipe ou comitê.',
  campos: CAMPOS,
  camposParticipante: [],
  plataformaNoLocal: true,
  rotuloPapel: 'Cargo / empresa',
  rotulos: { participantes: 'Participantes', pauta: 'Pauta' },
  secoes: SECOES,
  temEncaminhamentos: true,
  camposNoPrompt: ['data', 'modalidade'],
  regrasPrompt: REGRAS_PROMPT,
  titulo: (dados) => {
    const assunto = textoLimpo(dados.assunto);
    return assunto === '' ? 'Ata de reunião' : `Ata de reunião — ${assunto}`;
  },
  cabecalho,
  preambulo,
  fecho,
  assinaturas,
};
