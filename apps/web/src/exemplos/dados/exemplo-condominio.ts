import { CNPJ_EXEMPLO, CPF_EXEMPLO, TELEFONE_EXEMPLO } from '../ficticios';
import logoSvg from '../logo-exemplo.svg?raw';
import { falas, paragrafo, participantesDoExemplo } from '../montar';
import type { Exemplo } from '../tipos';

/**
 * Assembleia geral extraordinária fictícia de um condomínio residencial (tipo `condominio`). O
 * item 2 foi votado sem que o resultado fosse dito: a ata sai com a lacuna de propósito, para o
 * modal de download ter o que mostrar.
 */

const TIPO = 'condominio';

const ROBERTO = 'Roberto Almeida';
const CLAUDIA = 'Cláudia Martins';
const VERA = 'Vera Lúcia Santos';
const ANTONIO = 'Antônio Ferraz';
const DEBORA = 'Débora Quintana';
const GUSTAVO = 'Gustavo Lima';
const HELENA = 'Helena Duarte';
const IGOR = 'Igor Batista';
const LIVIA = 'Lívia Barros';
const SERGIO = 'Sérgio Pacheco';
const NELSON = 'Nelson Prates';
const OTAVIO = 'Otávio Reis';

const PROPRIETARIO = 'proprietario';
const PROCURADOR = 'procurador';
const FRACAO_TIPO = '0,0833';

export const exemplo: Exemplo = {
  tipoId: TIPO,
  dados: {
    condominio: 'Condomínio Edifício Exemplo',
    cnpj: CNPJ_EXEMPLO,
    endereco: 'Rua Exemplo, 250 — Jardim Exemplo',
    natureza: 'extraordinaria',
    chamada: 'segunda',
    edital_data: '2026-10-01',
    data: '2026-10-15',
    inicio: '19:30',
    fim: '21:05',
    modalidade: 'presencial',
    local: 'salão de festas do edifício',
    presidente: ROBERTO,
    secretario: CLAUDIA,
    assinaturas_presentes: 'mesa',
  },
  pauta: [
    'Impermeabilização da laje da cobertura e rateio extra',
    'Instalação de câmeras na garagem',
  ],
  participantes: participantesDoExemplo(TIPO, [
    { nome: ANTONIO, extras: { unidade: 'Apto 11', vinculo: PROPRIETARIO, fracao: FRACAO_TIPO } },
    { nome: CLAUDIA, extras: { unidade: 'Apto 12', vinculo: PROPRIETARIO, fracao: FRACAO_TIPO } },
    { nome: DEBORA, extras: { unidade: 'Apto 21', vinculo: PROPRIETARIO, fracao: FRACAO_TIPO } },
    { nome: GUSTAVO, extras: { unidade: 'Apto 22', vinculo: PROPRIETARIO } },
    { nome: HELENA, extras: { unidade: 'Apto 31', vinculo: PROPRIETARIO } },
    { nome: IGOR, extras: { unidade: 'Apto 32', vinculo: PROPRIETARIO } },
    { nome: LIVIA, extras: { unidade: 'Apto 41', vinculo: PROPRIETARIO } },
    { nome: SERGIO, extras: { unidade: 'Apto 42', vinculo: PROCURADOR } },
    { nome: ROBERTO, extras: { unidade: 'Apto 51', vinculo: PROPRIETARIO, fracao: FRACAO_TIPO } },
    { nome: NELSON, extras: { unidade: 'Apto 52', vinculo: PROPRIETARIO } },
    { nome: OTAVIO, extras: { unidade: 'Apto 61', vinculo: PROPRIETARIO } },
    { nome: VERA, extras: { unidade: 'Apto 62', vinculo: PROPRIETARIO } },
  ]),
  transcricao: falas([
    `${VERA}: Boa noite. Como síndica, abro os trabalhos. Temos doze condôminos na lista de presença. Antes de tudo, precisamos escolher quem preside e quem secretaria.`,
    `${HELENA}: Indico o Roberto, do 51, para presidir.`,
    `${VERA}: Alguém se opõe? Ninguém. Roberto, a palavra é sua.`,
    `${ROBERTO}: Obrigado. Convido a Cláudia, do 12, para secretariar. Antes de começar, Cláudia, as procurações conferem?`,
    `${CLAUDIA}: Só tem uma, do Sérgio, pelo apartamento 42. A firma está reconhecida e o CPF dele confere com a procuração: ${CPF_EXEMPLO}.`,
    `${ROBERTO}: Então, com doze condôminos presentes, declaro atingido o quórum de instalação e abro a assembleia. Primeiro item: a laje da cobertura.`,
    `${VERA}: A laje tem infiltração há dois invernos e já molhou o teto do 61 e do 62. Pedimos três orçamentos. O menor é de 96 mil reais, com garantia de cinco anos, pago em seis parcelas. O rateio seguiria a fração ideal, como manda a convenção.`,
    `${ANTONIO}: Acho caro e acho que dá para esperar o fundo de reserva crescer. Sou contra fazer agora.`,
    `${OTAVIO}: Esperar não dá. A água já entrou no meu apartamento duas vezes este ano.`,
    `${HELENA}: As seis parcelas começam quando?`,
    `${VERA}: Junto com o boleto de novembro. Se for aprovado, eu contrato a empresa, e a obra começa na primeira semana de novembro e leva uns quarenta dias.`,
    `${ROBERTO}: Vamos votar o item 1, a impermeabilização pelo orçamento de 96 mil reais, em seis parcelas, com rateio pela fração ideal. Contando as mãos: 9 votos a favor, 2 votos contra e 1 abstenção. Está aprovado.`,
    `${ROBERTO}: Segundo item: câmeras na garagem.`,
    `${GUSTAVO}: Tivemos dois retrovisores quebrados este ano e ninguém sabe quem foi. Proponho quatro câmeras na garagem, gravando em um equipamento na portaria.`,
    `${DEBORA}: Sou a favor, mas quero saber quem vai ver as imagens. Não pode ficar aberto para qualquer um.`,
    `${GUSTAVO}: A ideia é só a síndica acessar, e só quando houver ocorrência.`,
    `${NELSON}: E quanto custa?`,
    `${VERA}: O orçamento que temos é de 7 mil e 800 reais, com instalação, pago com o fundo de reserva.`,
    `${ROBERTO}: Vamos votar o item 2. Quem é a favor levante a mão. Cláudia, anota a contagem. Com a procuração no meio, a gente confere com calma e divulga o resultado no comunicado.`,
    `${CLAUDIA}: Anotado. Confiro com a procuração e passo o resultado no comunicado da semana que vem.`,
    `${VERA}: Antes de encerrar, um aviso: quem quiser acompanhar a obra da laje pode falar com a administradora pelo ${TELEFONE_EXEMPLO}.`,
    `${ROBERTO}: Nada mais a tratar, agradeço a presença de todos.`,
  ]),
  saida: {
    secoes: {
      abertura_instalacao: [
        paragrafo(
          'A síndica, Vera Lúcia Santos, abriu os trabalhos e informou que doze condôminos assinaram a lista de presença. Depois da escolha da mesa, o presidente declarou atingido o quórum de instalação, com doze condôminos presentes. A secretária informou que havia uma procuração, de Sérgio Pacheco, pelo Apto 42, com firma reconhecida e conferida.',
        ),
      ],
      eleicao_mesa: [
        paragrafo(
          'Helena Duarte indicou Roberto Almeida, do Apto 51, para presidir a assembleia, e não houve oposição. O presidente convidou Cláudia Martins, do Apto 12, para secretariar.',
        ),
      ],
      ordem_do_dia: [
        paragrafo(
          'Item 1 — Impermeabilização da laje da cobertura e rateio extra. A síndica relatou infiltrações na laje há dois invernos, que já atingiram os Aptos 61 e 62, e apresentou o menor de três orçamentos: R$ 96.000,00, com garantia de cinco anos, em seis parcelas, com rateio pela fração ideal, conforme a convenção, a partir do boleto de novembro; a obra começaria na primeira semana de novembro, com duração aproximada de quarenta dias. Antônio Ferraz manifestou-se contra a realização da obra neste momento, por considerar o valor alto e preferir aguardar o crescimento do fundo de reserva. Otávio Reis defendeu a obra imediata, relatando duas entradas de água em seu apartamento neste ano. Submetida a matéria à votação, o presidente declarou 9 votos a favor, 2 votos contra e 1 abstenção, e declarou aprovada a impermeabilização nos termos apresentados.',
        ),
        paragrafo(
          'Item 2 — Instalação de câmeras na garagem. Gustavo Lima propôs instalar quatro câmeras na garagem, com gravação em equipamento na portaria, em razão de dois retrovisores danificados neste ano sem autoria conhecida. Débora Quintana manifestou-se a favor e pediu que o acesso às imagens fosse restrito; Gustavo Lima esclareceu que a proposta prevê acesso apenas da síndica e somente em caso de ocorrência. A síndica informou o orçamento de R$ 7.800,00, com instalação, a ser pago com o fundo de reserva. Submetida a matéria à votação, a contagem foi anotada pela secretária para conferência com a procuração. Resultado: [PREENCHER: resultado da votação].',
        ),
      ],
      encerramento: [
        paragrafo(
          'A síndica informou que o acompanhamento da obra da laje pode ser feito com a administradora, pelo telefone informado na assembleia.',
        ),
      ],
    },
    encaminhamentos: [
      {
        acao: 'Contratar a empresa do orçamento aprovado e iniciar a impermeabilização da laje',
        responsavel: VERA,
        prazo: 'primeira semana de novembro',
        status: 'pendente',
      },
      {
        acao: 'Conferir a contagem da votação do item 2 com a procuração e divulgar o resultado em comunicado',
        responsavel: CLAUDIA,
        prazo: 'semana que vem',
        status: 'pendente',
      },
    ],
  },
  logoSvg,
};
