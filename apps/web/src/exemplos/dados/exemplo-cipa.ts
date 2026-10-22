import { CPF_EXEMPLO, TELEFONE_EXEMPLO } from '../ficticios';
import logoSvg from '../logo-exemplo.svg?raw';
import { falas, lista, paragrafo, participantesDoExemplo } from '../montar';
import type { Exemplo } from '../tipos';

/** Reunião ordinária fictícia da CIPA de uma metalúrgica (tipo `cipa`). */

const TIPO = 'cipa';

const CARLOS = 'Carlos Menezes';
const SANDRA = 'Sandra Ribeiro';
const EDUARDO = 'Eduardo Campos';
const FERNANDA = 'Fernanda Lopes';
const JOAO = 'João Batista Rocha';
const PATRICIA = 'Patrícia Nogueira';
const MARCOS = 'Marcos Vieira';
const LUCIANA = 'Luciana Freitas';

const ORGANIZACAO = 'organizacao';
const EMPREGADOS = 'empregados';
const TITULAR = 'titular';
const SUPLENTE = 'suplente';

export const exemplo: Exemplo = {
  tipoId: TIPO,
  dados: {
    empresa: 'Metalúrgica Exemplo Ltda.',
    estabelecimento: 'Unidade Distrito Industrial',
    gestao: '2026/2027',
    numero: '7',
    natureza: 'ordinaria',
    data: '2026-10-08',
    inicio: '09:00',
    fim: '10:20',
    modalidade: 'presencial',
    local: 'sala de treinamento do prédio administrativo',
    presidente: CARLOS,
    secretario: PATRICIA,
  },
  pauta: [
    'Leitura da ata da reunião anterior',
    'Quase-acidente na prensa hidráulica 3',
    'Inspeção no setor de estamparia',
    'Campanha de prevenção ao assédio',
  ],
  participantes: participantesDoExemplo(TIPO, [
    {
      nome: CARLOS,
      papel: 'Gerente de produção',
      extras: { representacao: ORGANIZACAO, condicao: TITULAR },
    },
    {
      nome: SANDRA,
      papel: 'Supervisora de manutenção',
      extras: { representacao: ORGANIZACAO, condicao: TITULAR },
    },
    {
      nome: EDUARDO,
      papel: 'Supervisor de logística',
      extras: { representacao: ORGANIZACAO, condicao: TITULAR },
    },
    {
      nome: FERNANDA,
      papel: 'Analista de recursos humanos',
      presenca: 'justificado',
      justificativa: 'Em férias',
      extras: { representacao: ORGANIZACAO, condicao: SUPLENTE },
    },
    {
      nome: JOAO,
      papel: 'Operador de prensa',
      extras: { representacao: EMPREGADOS, condicao: TITULAR },
    },
    {
      nome: PATRICIA,
      papel: 'Auxiliar administrativa',
      extras: { representacao: EMPREGADOS, condicao: TITULAR },
    },
    {
      nome: MARCOS,
      papel: 'Soldador',
      extras: { representacao: EMPREGADOS, condicao: TITULAR },
    },
    {
      nome: LUCIANA,
      papel: 'Inspetora de qualidade',
      extras: { representacao: EMPREGADOS, condicao: SUPLENTE },
    },
  ]),
  transcricao: falas([
    `${CARLOS}: Bom dia. Vamos abrir a sétima reunião ordinária da CIPA. A Fernanda está de férias e justificou a ausência. A Patrícia secretaria hoje. Patrícia, pode ler a ata anterior?`,
    `${PATRICIA}: Posso. Na sexta reunião tratamos da sinalização do pátio, da troca das luvas e da inspeção. Alguém tem correção?`,
    `${MARCOS}: Tenho uma. Na parte da inspeção está escrito estamparia, mas a inspeção foi na solda.`,
    `${CARLOS}: Bem lembrado. Com essa correção, todos de acordo com a ata? Então a ata da sexta reunião está aprovada por consenso.`,
    `${CARLOS}: Pendências da reunião passada. Eduardo, e a sinalização?`,
    `${EDUARDO}: As faixas de pedestres do pátio foram pintadas na semana passada. Está concluído.`,
    `${SANDRA}: As luvas anticorte novas foram compradas e chegam na semana que vem. Essa ainda está em andamento.`,
    `${CARLOS}: Agora o principal: o quase-acidente na prensa 3. João, você estava lá.`,
    `${JOAO}: Foi no dia 2, no segundo turno. A cortina de luz da prensa 3 estava desligada depois de um ajuste da manutenção, e a prensa fez um ciclo com um colega ainda perto da área de prensagem. Ninguém se machucou, mas foi por pouco.`,
    `${SANDRA}: Analisamos com a manutenção. O ajuste terminou no fim do turno e ninguém religou a cortina de luz. O bloqueio e a etiquetagem não foram seguidos até o fim, e não existe uma conferência antes de devolver a máquina para a produção.`,
    `${JOAO}: Os operadores também não sabiam que a cortina estava desligada. Não tinha nenhum aviso no painel.`,
    `${SANDRA}: Minha proposta é um checklist de liberação, assinado pela manutenção e pelo operador, toda vez que a máquina voltar de manutenção. E um retreinamento de bloqueio e etiquetagem para as duas equipes. O checklist eu consigo implantar até o dia 16.`,
    `${MARCOS}: Sobre a inspeção na estamparia: tinha óleo no piso perto da prensa 5, um extintor bloqueado por caixas e o corredor do fundo com pouca iluminação.`,
    `${EDUARDO}: As caixas são da logística. Tiro hoje mesmo e peço a limpeza do óleo.`,
    `${SANDRA}: A iluminação entra no pedido de manutenção elétrica deste mês.`,
    `${LUCIANA}: Sobre a campanha contra o assédio, a proposta é fazer em novembro, com uma conversa por turno e cartazes explicando o canal de denúncia. O canal atende pelo ${TELEFONE_EXEMPLO} e a denúncia pode ser anônima. Eu cuido da organização.`,
    `${PATRICIA}: Uma coisa prática: a plataforma do curso da CIPA recusou o cadastro do Marcos. Marcos, o seu CPF é ${CPF_EXEMPLO}, certo?`,
    `${MARCOS}: É esse mesmo.`,
    `${PATRICIA}: Então eu corrijo o cadastro até a semana que vem.`,
    `${CARLOS}: Vamos às deliberações. Checklist de liberação depois de manutenção, retreinamento de bloqueio e etiquetagem até o fim do mês e a campanha contra o assédio em novembro. O retreinamento eu organizo com o RH. Todos de acordo? Aprovado por consenso.`,
    `${LUCIANA}: Antes de encerrar, lembro que a SIPAT começa no dia 23 de novembro e a programação ainda está aberta para sugestões.`,
    `${CARLOS}: Obrigado a todos. Encerramos por hoje.`,
  ]),
  saida: {
    secoes: {
      abertura: [
        paragrafo(
          'O presidente, Carlos Menezes, abriu os trabalhos e informou a ausência justificada de Fernanda Lopes, que está em férias.',
        ),
      ],
      ata_anterior: [
        paragrafo(
          'Patrícia Nogueira leu a ata da sexta reunião ordinária. Marcos Vieira pediu a correção do setor citado no relato da inspeção, de estamparia para solda. Com a correção, a ata foi aprovada por consenso.',
        ),
      ],
      pendencias_anteriores: [
        lista([
          'Sinalização das faixas de pedestres do pátio: concluída, segundo Eduardo Campos.',
          'Troca das luvas anticorte: em andamento; segundo Sandra Ribeiro, as luvas foram compradas e chegam na próxima semana.',
        ]),
      ],
      discussao: [
        paragrafo(
          'Quase-acidente na prensa hidráulica 3. João Batista Rocha relatou que, no dia 2, no segundo turno, a prensa fez um ciclo com a cortina de luz desligada após um ajuste da manutenção, com um empregado ainda próximo da área de prensagem; não houve lesão. Sandra Ribeiro apresentou a análise feita com a manutenção: a cortina de luz não foi religada ao fim do ajuste, o procedimento de bloqueio e etiquetagem não foi seguido até o fim e não há conferência antes da devolução da máquina à produção. João Batista Rocha acrescentou que não havia aviso no painel. Sandra Ribeiro propôs um checklist de liberação, assinado pela manutenção e pelo operador, sempre que a máquina retornar de manutenção, e o retreinamento das duas equipes em bloqueio e etiquetagem.',
        ),
        paragrafo(
          'Inspeção no setor de estamparia. Marcos Vieira relatou óleo no piso próximo à prensa 5, um extintor obstruído por caixas e iluminação insuficiente no corredor do fundo. Eduardo Campos informou que as caixas pertencem à logística, que as retiraria no mesmo dia e que pediria a limpeza do óleo; Sandra Ribeiro informou que a iluminação entra no pedido de manutenção elétrica do mês.',
        ),
        paragrafo(
          'Campanha de prevenção ao assédio. Luciana Freitas propôs realizar a campanha em novembro, com uma conversa por turno e cartazes sobre o canal de denúncia, que aceita denúncias anônimas.',
        ),
        paragrafo(
          'Outros assuntos. Patrícia Nogueira informou que a plataforma do curso da CIPA recusou o cadastro de Marcos Vieira e que fará a correção.',
        ),
      ],
      deliberacoes: [
        lista([
          'Implantar o checklist de liberação de máquina após manutenção, assinado pela manutenção e pelo operador: aprovado por consenso.',
          'Retreinar as equipes de manutenção e de produção em bloqueio e etiquetagem até o fim do mês: aprovado por consenso.',
          'Realizar a campanha de prevenção ao assédio em novembro: aprovada por consenso.',
        ]),
      ],
      encerramento: [
        paragrafo(
          'Luciana Freitas lembrou que a SIPAT começa no dia 23 de novembro e que a programação está aberta a sugestões.',
        ),
      ],
    },
    encaminhamentos: [
      {
        acao: 'Implantar o checklist de liberação de máquina após manutenção',
        responsavel: SANDRA,
        prazo: '2026-10-16',
        status: 'pendente',
      },
      {
        acao: 'Retreinar as equipes de manutenção e de produção em bloqueio e etiquetagem',
        responsavel: CARLOS,
        prazo: '2026-10-31',
        status: 'pendente',
      },
      {
        acao: 'Retirar as caixas que bloqueiam o extintor da estamparia e pedir a limpeza do óleo do piso',
        responsavel: EDUARDO,
        prazo: '2026-10-08',
        status: 'pendente',
      },
      {
        acao: 'Organizar a campanha de prevenção ao assédio',
        responsavel: LUCIANA,
        prazo: 'novembro',
        status: 'pendente',
      },
      {
        acao: 'Corrigir o cadastro de Marcos Vieira na plataforma do curso da CIPA',
        responsavel: PATRICIA,
        prazo: 'semana que vem',
        status: 'pendente',
      },
    ],
  },
  logoSvg,
};
