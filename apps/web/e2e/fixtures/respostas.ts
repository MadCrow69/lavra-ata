/**
 * Respostas fixas dos provedores, no formato real de cada API (as mesmas formas que os adaptadores
 * de `src/ai/providers` leem). O texto do modelo é o JSON do schema da ata corporativa.
 */

/** Marcador que o app põe no lugar do CPF antes de enviar; a resposta o cita e o app restaura. */
export const MARCADOR_CPF = '[CPF_1]';

const STATUS_EM_ROTACAO = ['pendente', 'em_andamento', 'concluido'] as const;

/** Responsáveis distintos nos encaminhamentos de volume (a lista do "Copiar tarefas" tem vários grupos). */
const RESPONSAVEIS_DE_VOLUME = 40;

/** `quantos` encaminhamentos com prazo, status e responsável em rodízio (volume de 200 itens). */
function encaminhamentosDeVolume(quantos: number) {
  return Array.from({ length: quantos }, (_, i) => ({
    acao: `Acompanhar o item ${String(i + 1).padStart(3, '0')} do cronograma de migração do cadastro`,
    responsavel: `Responsável ${String((i % RESPONSAVEIS_DE_VOLUME) + 1).padStart(2, '0')}`,
    prazo: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    status: STATUS_EM_ROTACAO[i % STATUS_EM_ROTACAO.length],
  }));
}

/** Tipos de ata que o fixture sabe responder (as chaves de `secoes` são as do tipo correspondente). */
export type TipoFixture = 'corporativa' | 'cipa' | 'condominio' | 'socios-ltda';

interface BlocoJson {
  tipo: 'paragrafo' | 'lista';
  texto: string;
  itens: string[];
}

const paragrafo = (texto: string): BlocoJson => ({ tipo: 'paragrafo', texto, itens: [] });
const lista = (itens: string[]): BlocoJson => ({ tipo: 'lista', texto: '', itens });

/** `secoes` de cada tipo, escritas do zero com as chaves de `SECOES` do tipo (seção vazia = `[]`). */
const SECOES_POR_TIPO: Record<TipoFixture, Record<string, BlocoJson[]>> = {
  corporativa: {
    resumo: [
      paragrafo(
        'A equipe revisou o cronograma do projeto Horizonte e aprovou a migração do cadastro de fornecedores.',
      ),
    ],
    discussao: [
      paragrafo(
        `Marcos Ferraz informou que o cadastro do fornecedor depende do documento ${MARCADOR_CPF} do sócio responsável.`,
      ),
      paragrafo('Joana Prado apresentou o orçamento e pediu a validação do jurídico.'),
    ],
    decisoes: [
      lista(['Migrar o cadastro de fornecedores até 30/11.', 'Adiar a fase 3 para 2027.']),
    ],
    pendencias: [paragrafo('Falta confirmar o contrato de suporte com o fornecedor.')],
    riscos: [paragrafo('Prazo curto para a homologação do fornecedor.')],
    proxima_reuniao: [paragrafo('Nova reunião em 28/10/2026, às 14h, por videoconferência.')],
  },
  cipa: {
    abertura: [
      paragrafo(
        'O presidente abriu os trabalhos e informou que a reunião foi convocada para tratar do acidente ocorrido no setor de expedição.',
      ),
    ],
    ata_anterior: [],
    pendencias_anteriores: [
      paragrafo(
        'A sinalização do corredor de carga, pendente desde a reunião anterior, segue em andamento.',
      ),
    ],
    discussao: [
      paragrafo(
        `Marcos Ferraz relatou o acidente e citou o documento ${MARCADOR_CPF} da pessoa responsável pelo setor.`,
      ),
      paragrafo('Os membros analisaram as condições do corredor de carga e as medidas propostas.'),
    ],
    deliberacoes: [
      paragrafo(
        'Foi deliberada a instalação de sinalização de piso no corredor de carga. [PREENCHER: forma de deliberação]',
      ),
    ],
    encerramento: [],
  },
  condominio: {
    abertura_instalacao: [
      paragrafo('O presidente da mesa abriu os trabalhos e declarou instalada a assembleia.'),
    ],
    eleicao_mesa: [],
    ordem_do_dia: [
      paragrafo(
        'Prestação de contas do exercício: a síndica apresentou o relatório e a pauta foi colocada em votação. [PREENCHER: resultado da votação]',
      ),
      paragrafo('Reforma da portaria: os presentes debateram os orçamentos recebidos.'),
    ],
    encerramento: [],
  },
  'socios-ltda': {
    instalacao: [paragrafo('O presidente abriu os trabalhos e declarou instalada a reunião.')],
    deliberacoes: [
      paragrafo('Os sócios deliberaram sobre a mudança do endereço da sede da sociedade.'),
    ],
    encerramento: [],
  },
};

/**
 * Conteúdo da ata, já no schema de `src/generation/output-schema.ts` (todas as seções do `tipo` +
 * encaminhamentos). Sem `encaminhamentos`, os 2 de sempre; com, esse tanto (teste de volume).
 */
export function ataGeradaJson({
  encaminhamentos,
  tipo = 'corporativa',
}: { encaminhamentos?: number; tipo?: TipoFixture } = {}): string {
  return JSON.stringify({
    secoes: SECOES_POR_TIPO[tipo],
    encaminhamentos:
      encaminhamentos === undefined
        ? [
            {
              acao: 'Enviar o contrato de suporte ao jurídico',
              responsavel: 'Joana Prado',
              prazo: '2026-10-21',
              status: 'pendente',
            },
            {
              acao: 'Concluir a migração do cadastro',
              responsavel: 'Marcos Ferraz',
              prazo: '2026-11-30',
              status: 'em_andamento',
            },
          ]
        : encaminhamentosDeVolume(encaminhamentos),
  });
}

/** OpenAI, Responses API: `output[]` com item `message` e parte `output_text`. */
export function respostaOpenAi(texto: string = ataGeradaJson()): unknown {
  return {
    id: 'resp_teste_e2e',
    object: 'response',
    status: 'completed',
    model: 'gpt-6-luna',
    output: [
      {
        id: 'msg_teste_e2e',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: texto, annotations: [] }],
      },
    ],
  };
}

/** Gemini, `generateContent`: `candidates[0].content.parts[].text` e `finishReason: 'STOP'`. */
export function respostaGemini(texto: string = ataGeradaJson()): unknown {
  return {
    candidates: [
      {
        content: { role: 'model', parts: [{ text: texto }] },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    modelVersion: 'gemini-3.8-flash',
  };
}

/** Anthropic, Messages API: bloco `thinking` antes do bloco `text` e `stop_reason: 'end_turn'`. */
export function respostaAnthropic(texto: string = ataGeradaJson()): unknown {
  return {
    id: 'msg_teste_e2e',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [
      {
        type: 'thinking',
        thinking: 'Organizando as seções da ata.',
        signature: 'assinatura-teste',
      },
      { type: 'text', text: texto },
    ],
    stop_reason: 'end_turn',
  };
}

/** Corpo de erro 429 no formato da OpenAI. */
export const ERRO_LIMITE_OPENAI = {
  error: {
    message: 'Rate limit reached for requests',
    type: 'requests',
    param: null,
    code: 'rate_limit_exceeded',
  },
};
