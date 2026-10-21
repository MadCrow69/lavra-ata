import { ROTULO_PROVEDOR } from '../config/models';
import type { ErroTipo, FalhaProvedor, ProviderId } from './types';

/** Erro de uma chamada a um provedor. `message` é pt-BR e NUNCA contém a chave de API. */
export class ErroProvedor extends Error {
  readonly tipo: ErroTipo;
  readonly provedor: ProviderId;
  readonly status?: number;
  /**
   * A cadeia só repete a chamada (uma vez) quando isto é true. Vale para falha de nível HTTP/rede
   * (429, 5xx/529, sobrecarga); uma resposta 200 que o adaptador classificou como `instavel`
   * não é repetível — o padrão é `tipo` ser `limite` ou `instavel`, e os adaptadores desligam.
   */
  readonly repetivel: boolean;
  /** A conta do provedor está sem crédito ou saldo (a chave em si pode estar correta). */
  readonly semCredito: boolean;

  constructor(
    tipo: ErroTipo,
    provedor: ProviderId,
    mensagem: string,
    status?: number,
    opcoes: { repetivel?: boolean; semCredito?: boolean } = {},
  ) {
    super(mensagem);
    this.name = 'ErroProvedor';
    this.tipo = tipo;
    this.provedor = provedor;
    this.repetivel = opcoes.repetivel ?? (tipo === 'limite' || tipo === 'instavel');
    this.semCredito = opcoes.semCredito ?? false;
    if (status !== undefined) this.status = status;
  }
}

/** Todos os provedores da cadeia falharam (ou a cadeia veio vazia). */
export class ErroCadeia extends Error {
  readonly falhas: FalhaProvedor[];

  constructor(falhas: FalhaProvedor[], mensagem: string) {
    super(mensagem);
    this.name = 'ErroCadeia';
    this.falhas = falhas;
  }
}

const CHAVE_REMOVIDA = '[chave removida]';

/** Formatos conhecidos de chave (`sk-ant-…`, `sk-…`, `AIza…`) e cabeçalhos com credencial. */
const PADROES_DE_CHAVE: RegExp[] = [
  /Bearer\s+[^\s,;"']+/gi,
  // Sem letra/dígito antes: "risk-…" e "task-…" não são chaves.
  /(?<![A-Za-z0-9])sk-[\w*-]+/g,
  /(?<![A-Za-z0-9])AIza[\w*-]+/g,
];

const LIMITE_DETALHE = 200;

/**
 * Remove do texto do provedor a chave da pessoa e qualquer coisa com cara de chave.
 * Usar SEMPRE antes de colocar texto vindo do provedor numa mensagem de erro.
 */
export function sanitizar(texto: string, chave: string): string {
  let saida = texto;
  for (const forma of new Set([chave, chave.trim()])) {
    if (forma.length > 0) saida = saida.split(forma).join(CHAVE_REMOVIDA);
  }
  for (const padrao of PADROES_DE_CHAVE) saida = saida.replace(padrao, CHAVE_REMOVIDA);
  return saida.replace(/\s+/g, ' ').trim().slice(0, LIMITE_DETALHE);
}

interface ContextoMensagem {
  modelo?: string;
  detalhe?: string;
  status?: number;
}

/** Mensagem em pt-BR (causa + ação) para cada tipo de erro. `detalhe` já deve estar sanitizado. */
export function mensagemDeErro(
  tipo: ErroTipo,
  provedor: ProviderId,
  ctx: ContextoMensagem = {},
): string {
  const rot = ROTULO_PROVEDOR[provedor];
  const detalhe = ctx.detalhe ? ` Detalhe informado pelo provedor: ${ctx.detalhe}` : '';
  switch (tipo) {
    case 'chave_invalida':
      return `A chave de ${rot} foi recusada. Confira se a copiou inteira e se está ativa no painel do provedor.`;
    case 'limite':
      return `${rot} atingiu o limite de uso (muitas chamadas seguidas ou cota esgotada). Aguarde um instante e tente de novo, ou use outro provedor.`;
    case 'instavel':
      return `${rot} está instável ou sobrecarregado no momento. Tente de novo em instantes ou use outro provedor.${detalhe}`;
    case 'cortado':
      return `A resposta de ${rot} foi cortada antes de terminar. Reduza a transcrição ou escolha um modelo com mais capacidade.`;
    case 'json_invalido':
      return `${rot} devolveu uma resposta fora do formato esperado. Gere de novo ou escolha outro modelo.`;
    case 'recusa':
      return `${rot} recusou gerar esta ata pelas suas políticas de conteúdo. Revise a transcrição ou use outro provedor.`;
    case 'rede':
      return 'O provedor recusou a chamada direta do navegador ou a conexão falhou. Verifique sua conexão com a internet e tente de novo.';
    case 'parametro':
      return `O modelo ${ctx.modelo ?? 'escolhido'} não aceitou a configuração enviada. Escolha outro modelo nas configurações.`;
    case 'muito_longo':
      return `A transcrição ficou grande demais para o modelo ${ctx.modelo ?? 'escolhido'}. Divida a reunião ou escolha um modelo com mais contexto.`;
    case 'inesperado':
      return `${rot} recusou a chamada${ctx.status === undefined ? '' : ` (HTTP ${String(ctx.status)})`}. Tente de novo ou use outro provedor.${detalhe}`;
    case 'cancelado':
      return 'A geração foi cancelada.';
  }
}

/** Cria um ErroProvedor com a mensagem padrão do tipo. */
export function erroProvedor(
  tipo: ErroTipo,
  provedor: ProviderId,
  opcoes: ContextoMensagem & { repetivel?: boolean } = {},
): ErroProvedor {
  return new ErroProvedor(
    tipo,
    provedor,
    mensagemDeErro(tipo, provedor, opcoes),
    opcoes.status,
    opcoes.repetivel === undefined ? {} : { repetivel: opcoes.repetivel },
  );
}

/** Conta sem crédito ou saldo: fonte única do texto (erro do provedor e cartão da chave). */
export function mensagemSemCredito(provedor: ProviderId): string {
  return `A conta de ${ROTULO_PROVEDOR[provedor]} está sem crédito ou saldo. Confira o saldo e a cobrança no painel do provedor.`;
}

/** Causa curta de cada erro, para listas compactas (ex.: "OpenAI falhou (limite de uso)"). */
const RESUMO_DO_ERRO: Record<ErroTipo, string> = {
  chave_invalida: 'chave recusada ou sem crédito',
  limite: 'limite de uso',
  instavel: 'instabilidade no provedor',
  cortado: 'resposta cortada',
  json_invalido: 'resposta fora do formato',
  recusa: 'recusou o conteúdo',
  rede: 'falha de conexão',
  parametro: 'modelo não aceitou a configuração',
  muito_longo: 'transcrição grande demais para o modelo',
  inesperado: 'erro inesperado',
  cancelado: 'cancelado',
};

export function resumoDoErro(tipo: ErroTipo): string {
  return RESUMO_DO_ERRO[tipo];
}
