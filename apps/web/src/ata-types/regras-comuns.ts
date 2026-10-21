/**
 * Regras de redação enviadas à IA em toda ata, qualquer que seja o tipo.
 * O tom (formal, conciso ou detalhado) e as regras do tipo são somados a estas.
 */
export const REGRAS_COMUNS: readonly string[] = [
  'Escreva em português do Brasil, com acentuação correta, em voz impessoal e registro formal.',
  'Não invente. Registre apenas o que aparece na transcrição ou nos dados da reunião informados.',
  'Uma decisão só entra como decisão se foi dita de forma explícita; na dúvida, descreva o assunto na discussão.',
  'Aprovação, unanimidade, contagem de votos e quórum só podem constar se foram ditos na reunião.',
  'Quando faltar uma informação necessária, escreva [PREENCHER: o que falta] no lugar, nunca um palpite.',
  'Responsável sem clareza: use "A definir". Prazo: data no formato AAAA-MM-DD quando for clara; senão, o texto dito (por exemplo, "próxima reunião").',
  'Use os nomes exatamente como aparecem na transcrição e na lista de participantes.',
  'Preserve literalmente os marcadores entre colchetes, como [CPF_1] ou [TELEFONE_2]: não os reescreva, não os corrija, não os explique.',
  'Não escreva títulos de seção, nem HTML, nem Markdown: os títulos vêm do modelo do documento e o conteúdo é texto puro.',
  'Responda somente com o JSON no formato pedido, sem texto antes ou depois.',
];

/** Aviso de minuta impresso em todas as atas, ao final do documento. */
export const AVISO_MINUTA =
  'Minuta elaborada com auxílio de inteligência artificial a partir de transcrição. ' +
  'Revise integralmente antes de assinar. Não substitui assessoria jurídica; ' +
  'a validade depende de convocação, quórum e assinaturas, que não foram verificados.';
