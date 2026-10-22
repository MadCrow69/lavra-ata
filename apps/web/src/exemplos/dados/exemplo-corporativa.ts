import { RESPONSAVEL_A_DEFINIR } from '../../config/documento';
import { CPF_EXEMPLO, EMAIL_EXEMPLO, TELEFONE_EXEMPLO } from '../ficticios';
import logoSvg from '../logo-exemplo.svg?raw';
import { falas, lista, paragrafo, participantesDoExemplo } from '../montar';
import type { Exemplo } from '../tipos';

/** Reunião de trabalho fictícia de uma empresa de software (tipo `corporativa`). */

const TIPO = 'corporativa';

const MARIANA = 'Mariana Teixeira';
const RAFAEL = 'Rafael Moura';
const BEATRIZ = 'Beatriz Lacerda';
const TIAGO = 'Tiago Fontana';
const JULIANA = 'Juliana Prado';
const HENRIQUE = 'Henrique Vasconcelos';

export const exemplo: Exemplo = {
  tipoId: TIPO,
  dados: {
    organizacao: 'Exemplo Tecnologia Ltda.',
    assunto: 'Planejamento do lançamento do aplicativo de agendamento',
    data: '2026-10-14',
    inicio: '14:00',
    fim: '15:10',
    modalidade: 'remota',
    local: 'videoconferência',
    conducao: MARIANA,
    redacao: RAFAEL,
  },
  pauta: [
    'Cronograma do lançamento',
    'Resultado dos testes com os clientes piloto',
    'Atendimento e comunicação do lançamento',
  ],
  participantes: participantesDoExemplo(TIPO, [
    { nome: MARIANA, papel: 'Gerente de produto' },
    { nome: RAFAEL, papel: 'Analista de projetos' },
    { nome: BEATRIZ, papel: 'Líder de desenvolvimento' },
    { nome: TIAGO, papel: 'Coordenador de qualidade' },
    { nome: JULIANA, papel: 'Analista de atendimento' },
    {
      nome: HENRIQUE,
      papel: 'Gerente comercial',
      presenca: 'justificado',
      justificativa: 'Em visita a cliente',
    },
  ]),
  transcricao: falas([
    `${MARIANA}: Boa tarde a todos. O Henrique avisou que está em visita a um cliente e não consegue entrar hoje. Vamos aos três pontos: cronograma, testes com os pilotos e atendimento. O Rafael fica com a ata.`,
    `${RAFAEL}: Combinado, estou anotando.`,
    `${MARIANA}: Começando pelo cronograma. Beatriz, como estão as últimas funcionalidades?`,
    `${BEATRIZ}: A agenda, a confirmação por mensagem e o cancelamento estão prontos. Falta só o lembrete do dia anterior, que termina até sexta. Com isso, a versão candidata sai no dia 23.`,
    `${MARIANA}: E a publicação nas lojas de aplicativos?`,
    `${BEATRIZ}: Esse é o meu receio. A revisão das lojas pode levar mais de uma semana, e se pedirem ajuste a gente perde a data. Eu enviaria a versão candidata para revisão assim que ela sair.`,
    `${MARIANA}: Faz sentido. Então fica decidido: o lançamento público é no dia 10 de novembro, e a versão candidata vai para a revisão das lojas no dia 23.`,
    `${TIAGO}: Sobre os pilotos: foram cinco clínicas, e quatro usaram todos os dias. O principal problema foi no cadastro. Uma clínica tentou cadastrar um paciente com o CPF ${CPF_EXEMPLO} e o aplicativo recusou, dizendo que o número era inválido.`,
    `${BEATRIZ}: Já achei a causa. A validação rejeitava o número quando ele vinha colado com pontos e traço. A correção está pronta e entra na versão de sexta para os pilotos. Eu libero essa versão na sexta.`,
    `${TIAGO}: Ótimo. Depois disso eu rodo a regressão completa até o dia 23, antes da versão candidata.`,
    `${MARIANA}: Mais alguma coisa dos pilotos?`,
    `${TIAGO}: Duas clínicas pediram para escolher o horário do lembrete. Não dá para entrar agora, mas fica registrado como pedido.`,
    `${MARIANA}: Fica para depois do lançamento. Juliana, e o atendimento?`,
    `${JULIANA}: Proponho atender por telefone e por e-mail no primeiro mês. O telefone do suporte seria o ${TELEFONE_EXEMPLO} e o e-mail, ${EMAIL_EXEMPLO}. Também preciso montar as respostas prontas para as dúvidas mais comuns.`,
    `${MARIANA}: Aprovado. O suporte do lançamento vai ser por telefone e por e-mail. Quando você consegue ter o roteiro?`,
    `${JULIANA}: Até o dia 28, para dar tempo de treinar a equipe antes do dia 10.`,
    `${TIAGO}: Eu me preocupo com o volume de chamados na primeira semana. Se tiver muita gente ao mesmo tempo, a equipe é pequena.`,
    `${JULIANA}: Concordo. Se passar de cinquenta chamados por dia, vou precisar de reforço.`,
    `${MARIANA}: Vamos acompanhar. E falta alinhar a campanha de lançamento com o comercial. Como o Henrique não está, alguém precisa falar com a equipe de vendas, mas ainda não sei quem. Deixo em aberto e resolvemos até a próxima reunião.`,
    `${RAFAEL}: Anotei como pendente, sem responsável por enquanto.`,
    `${MARIANA}: A página de ajuda dentro do aplicativo também continua sem texto. Vemos isso na próxima.`,
    `${MARIANA}: A próxima reunião fica para o dia 21 de outubro, às 14h, também por videoconferência. Obrigada a todos.`,
  ]),
  saida: {
    secoes: {
      resumo: [
        paragrafo(
          'A reunião tratou do planejamento do lançamento do aplicativo de agendamento: o cronograma até a publicação, o resultado dos testes com as clínicas piloto e a organização do atendimento no primeiro mês. Foram definidas a data do lançamento público e os canais de suporte, e ficaram registrados os riscos ligados à revisão das lojas de aplicativos e ao volume de chamados.',
        ),
      ],
      discussao: [
        paragrafo(
          'Cronograma do lançamento. Beatriz Lacerda informou que a agenda, a confirmação por mensagem e o cancelamento estão prontos e que o lembrete do dia anterior será concluído até sexta-feira, o que permite gerar a versão candidata no dia 23. Ela recomendou enviar essa versão à revisão das lojas de aplicativos assim que estiver pronta.',
        ),
        paragrafo(
          'Resultado dos testes com os clientes piloto. Tiago Fontana relatou que cinco clínicas participaram do piloto e que quatro usaram o aplicativo diariamente. O principal problema foi a recusa, no cadastro de paciente, de um CPF colado com pontos e traço. Beatriz Lacerda informou que a causa foi identificada e que a correção entra na versão de sexta-feira, que ela liberará para os pilotos; Tiago Fontana fará a regressão completa até o dia 23, antes da versão candidata. Duas clínicas pediram para escolher o horário do lembrete, pedido que ficou para depois do lançamento.',
        ),
        paragrafo(
          'Atendimento e comunicação do lançamento. Juliana Prado propôs atender por telefone e por e-mail no primeiro mês e preparar respostas prontas para as dúvidas mais comuns, com o roteiro pronto até o dia 28 para o treinamento da equipe. A campanha de lançamento ainda precisa ser alinhada com a equipe de vendas.',
        ),
      ],
      decisoes: [
        lista([
          'O lançamento público do aplicativo será no dia 10 de novembro.',
          'A versão candidata será enviada à revisão das lojas de aplicativos no dia 23.',
          'O suporte do lançamento será feito por telefone e por e-mail.',
        ]),
      ],
      pendencias: [
        lista([
          'Alinhar a campanha de lançamento com a equipe de vendas, sem responsável definido, até a próxima reunião.',
          'Escrever o texto da página de ajuda do aplicativo, a ser tratado na próxima reunião.',
          'Pedido das clínicas para escolher o horário do lembrete, deixado para depois do lançamento.',
        ]),
      ],
      riscos: [
        lista([
          'Beatriz Lacerda apontou que a revisão das lojas de aplicativos pode levar mais de uma semana e que um pedido de ajuste comprometeria a data do lançamento.',
          'Tiago Fontana apontou o risco de volume alto de chamados na primeira semana para uma equipe pequena; Juliana Prado indicou que, acima de cinquenta chamados por dia, será preciso reforço.',
        ]),
      ],
      proxima_reuniao: [
        paragrafo('A próxima reunião será no dia 21 de outubro, às 14h, por videoconferência.'),
      ],
    },
    encaminhamentos: [
      {
        acao: 'Liberar para os clientes piloto a versão com a correção da validação do CPF no cadastro',
        responsavel: BEATRIZ,
        prazo: '2026-10-16',
        status: 'pendente',
      },
      {
        acao: 'Rodar a regressão completa antes de gerar a versão candidata',
        responsavel: TIAGO,
        prazo: '2026-10-23',
        status: 'pendente',
      },
      {
        acao: 'Preparar o roteiro de atendimento e as respostas prontas do suporte',
        responsavel: JULIANA,
        prazo: '2026-10-28',
        status: 'pendente',
      },
      {
        acao: 'Alinhar a campanha de lançamento com a equipe de vendas',
        responsavel: RESPONSAVEL_A_DEFINIR,
        prazo: 'próxima reunião',
        status: 'pendente',
      },
    ],
  },
  logoSvg,
};
