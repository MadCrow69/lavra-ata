import { CNPJ_ALFANUMERICO_EXEMPLO, CPF_EXEMPLO, TELEFONE_EXEMPLO } from '../ficticios';
import logoSvg from '../logo-exemplo.svg?raw';
import { falas, paragrafo, participantesDoExemplo } from '../montar';
import type { Exemplo } from '../tipos';

/** Reunião fictícia dos sócios de uma sociedade limitada (tipo `socios-ltda`). */

const TIPO = 'socios-ltda';

const ANA = 'Ana Carolina Ramos';
const BRUNO = 'Bruno Tavares';
const CARLA = 'Carla Mendonça';

export const exemplo: Exemplo = {
  tipoId: TIPO,
  dados: {
    razao_social: 'Exemplo Comércio de Alimentos Ltda.',
    cnpj: CNPJ_ALFANUMERICO_EXEMPLO,
    sede: 'Avenida Exemplo, 1.200 — Centro',
    forma: 'reuniao',
    data: '2026-10-20',
    inicio: '10:00',
    fim: '11:15',
    modalidade: 'presencial',
    local: 'sala de reuniões da sede social',
    convocacao: 'presenca_todos',
    presidente: ANA,
    secretario: BRUNO,
    modo_capital: 'percentual',
    declaracao_formalidades: 'sim',
  },
  pauta: [
    'Investimento na reforma da cozinha industrial',
    'Financiamento para a compra de um veículo refrigerado',
  ],
  participantes: participantesDoExemplo(TIPO, [
    { nome: ANA, extras: { participacao: '50' } },
    { nome: BRUNO, extras: { participacao: '30' } },
    { nome: CARLA, extras: { participacao: '20' } },
  ]),
  transcricao: falas([
    `${ANA}: Bom dia. Estão aqui os três sócios, com a totalidade do capital social. Declaro atendido o quórum de instalação e instalada a reunião. O Bruno secretaria.`,
    `${BRUNO}: Certo, vou anotando.`,
    `${ANA}: Primeiro item: a reforma da cozinha industrial. O orçamento é de 180 mil reais, pago com o caixa da empresa. A obra seria em janeiro, quando o movimento cai.`,
    `${BRUNO}: A cozinha está no limite. Com a reforma, a gente dobra a produção de marmitas e para de perder pedido no almoço.`,
    `${CARLA}: Eu acho o valor alto para este ano. Prefiro trocar só a coifa agora e deixar a reforma completa para o segundo semestre.`,
    `${ANA}: Entendo, mas a coifa sozinha não resolve o problema da capacidade. Alguém quer acrescentar algo?`,
    `${CARLA}: Não. Só quero que conste que eu sou contra.`,
    `${ANA}: Então vamos votar. Eu voto a favor.`,
    `${BRUNO}: Também voto a favor.`,
    `${CARLA}: Voto contra e peço o registro da minha dissidência.`,
    `${ANA}: Aprovada a reforma, com os votos favoráveis meus e do Bruno. A Carla votou contra e a dissidência fica registrada. Eu fecho o contrato com a empreiteira até o fim de novembro.`,
    `${ANA}: Segundo item: o financiamento do veículo refrigerado. Bruno, você trouxe as condições?`,
    `${BRUNO}: Trouxe. São 210 mil reais em 36 parcelas no Banco Exemplo, com o próprio veículo como garantia. O gerente da conta pediu os documentos dos sócios. Ana, o seu CPF no cadastro do banco está como ${CPF_EXEMPLO}, confere?`,
    `${ANA}: Confere.`,
    `${BRUNO}: Ótimo. Qualquer dúvida sobre a proposta, o gerente atende pelo ${TELEFONE_EXEMPLO}.`,
    `${CARLA}: Esse eu apoio. Com o veículo próprio a gente deixa de pagar frete terceirizado. Só precisamos de seguro antes de o veículo começar a rodar. Eu cuido dos orçamentos de seguro.`,
    `${ANA}: Vamos votar o financiamento. Todos a favor? Aprovado por unanimidade. Bruno, você assina e manda a documentação ao banco até o dia 30.`,
    `${BRUNO}: Combinado.`,
    `${CARLA}: Antes de encerrar: o cardápio de fim de ano precisa ser fechado até a primeira semana de novembro, para dar tempo de comprar os insumos.`,
    `${ANA}: Anotado. Nada mais a tratar, encerramos.`,
  ]),
  saida: {
    secoes: {
      instalacao: [
        paragrafo(
          'A presidente, Ana Carolina Ramos, abriu os trabalhos, declarou presentes os três sócios, com a totalidade do capital social, e declarou atendido o quórum de instalação e instalada a reunião.',
        ),
      ],
      deliberacoes: [
        paragrafo(
          'Item 1 — Investimento na reforma da cozinha industrial. A presidente apresentou o orçamento de R$ 180.000,00, a ser pago com recursos de caixa da sociedade, com a obra prevista para janeiro. Bruno Tavares defendeu a reforma para ampliar a capacidade de produção. Carla Mendonça considerou o valor alto para este ano e propôs trocar apenas a coifa agora, deixando a reforma completa para o segundo semestre. Ana Carolina Ramos e Bruno Tavares votaram a favor; Carla Mendonça votou contra e pediu o registro de sua dissidência. A presidente declarou aprovada a reforma.',
        ),
        paragrafo(
          'Item 2 — Financiamento para a compra de um veículo refrigerado. Bruno Tavares apresentou as condições: R$ 210.000,00 em 36 parcelas no Banco Exemplo, com o próprio veículo em garantia. Carla Mendonça manifestou apoio, por eliminar o custo de frete terceirizado, e ressaltou a necessidade de seguro antes de o veículo começar a rodar. Submetida a matéria à votação, a presidente declarou o financiamento aprovado por unanimidade.',
        ),
      ],
      encerramento: [
        paragrafo(
          'Carla Mendonça lembrou que o cardápio de fim de ano precisa ser definido até a primeira semana de novembro, para a compra dos insumos.',
        ),
      ],
    },
    encaminhamentos: [
      {
        acao: 'Fechar o contrato da reforma da cozinha industrial com a empreiteira',
        responsavel: ANA,
        prazo: '2026-11-30',
        status: 'pendente',
      },
      {
        acao: 'Assinar o financiamento do veículo refrigerado e enviar a documentação ao banco',
        responsavel: BRUNO,
        prazo: '2026-10-30',
        status: 'pendente',
      },
      {
        acao: 'Levantar orçamentos de seguro para o veículo refrigerado',
        responsavel: CARLA,
        prazo: 'antes de o veículo começar a rodar',
        status: 'pendente',
      },
    ],
  },
  logoSvg,
};
