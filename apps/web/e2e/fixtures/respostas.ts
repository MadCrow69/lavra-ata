/**
 * Respostas fixas dos provedores, no formato real de cada API (as mesmas formas que os adaptadores
 * de `src/ai/providers` leem). O texto do modelo é o JSON do schema da ata corporativa.
 */

/** Marcador que o app põe no lugar do CPF antes de enviar; a resposta o cita e o app restaura. */
export const MARCADOR_CPF = '[CPF_1]';

/** Conteúdo da ata, já no schema de `src/generation/output-schema.ts` (todas as seções + encaminhamentos). */
export function ataGeradaJson(): string {
  const paragrafo = (texto: string) => ({ tipo: 'paragrafo', texto, itens: [] as string[] });
  const lista = (itens: string[]) => ({ tipo: 'lista', texto: '', itens });
  return JSON.stringify({
    secoes: {
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
    encaminhamentos: [
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
    ],
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
