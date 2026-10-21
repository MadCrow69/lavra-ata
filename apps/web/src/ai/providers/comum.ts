import { ErroProvedor, erroProvedor, mensagemSemCredito, sanitizar } from '../errors';
import { validarSchema } from '../json-schema';
import type { JsonSchema, ProviderId } from '../types';

export function ehRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Lista tipada como `unknown[]`; qualquer outra coisa vira lista vazia. */
export function comoLista(v: unknown): unknown[] {
  return Array.isArray(v) ? (v as unknown[]) : [];
}

export interface ChamadaHttp {
  provedor: ProviderId;
  chave: string;
  /** Modelo usado na chamada, para citar na mensagem de erro de parâmetro. */
  modelo?: string;
  url: string;
  metodo: 'GET' | 'POST';
  headers: Record<string, string>;
  corpo?: unknown;
  signal: AbortSignal;
}

const PADRAO_SEM_CREDITO = /credit balance|insufficient|billing|quota/i;
/**
 * Cota esgotada com 429: só o código da OpenAI. O `PADRAO_SEM_CREDITO` amplo não vale para 429,
 * porque o "quota" do Gemini é o limite por minuto (que melhora esperando).
 */
const PADRAO_COTA_ESGOTADA = /insufficient_quota/i;
const PADRAO_CHAVE_INVALIDA = /API key not valid|API_KEY_INVALID/i;
const PADRAO_MUITO_LONGO =
  /context[_ ]length|prompt is too long|maximum context|exceeds the maximum number of (input )?tokens|input token count|too many tokens|request too large/i;
const PADRAO_PARAMETRO =
  /unsupported|not supported|does not support|invalid (value|parameter|argument)|unknown (name|field|parameter)|extra inputs|input should be|not permitted|thinking|effort|temperature|budget/i;

function foiCancelado(e: unknown, signal: AbortSignal): boolean {
  // DOMException nem sempre herda de Error (jsdom), então confere só o `name`.
  return signal.aborted || (ehRegistro(e) && e.name === 'AbortError');
}

/** Campos do corpo de erro que ajudam a classificar (OpenAI, Anthropic e Gemini têm formatos próximos). */
interface CorpoDeErro {
  mensagem: string;
  /** Texto bruto para casar com os padrões: mensagem + códigos + razões em `details`. */
  pistas: string;
  temParam: boolean;
}

function lerCorpoDeErro(texto: string): CorpoDeErro {
  let mensagem = texto;
  const pistas: string[] = [];
  let temParam = false;
  try {
    const corpo: unknown = JSON.parse(texto);
    const erro = ehRegistro(corpo) ? corpo.error : undefined;
    if (ehRegistro(erro)) {
      if (typeof erro.message === 'string') mensagem = erro.message;
      for (const campo of [erro.code, erro.type, erro.status]) {
        if (typeof campo === 'string') pistas.push(campo);
      }
      if (typeof erro.param === 'string' && erro.param !== '') temParam = true;
      for (const detalhe of comoLista(erro.details)) {
        if (ehRegistro(detalhe) && typeof detalhe.reason === 'string') pistas.push(detalhe.reason);
      }
    }
  } catch {
    // corpo não é JSON (página de proxy, por exemplo): usa o texto cru, sanitizado.
  }
  return { mensagem, pistas: [mensagem, ...pistas].join(' '), temParam };
}

/** Conta sem crédito ou saldo: a chave não adianta até a pessoa recarregar; sem retry. */
export function erroSemCredito(provedor: ProviderId, status: number): ErroProvedor {
  return new ErroProvedor('chave_invalida', provedor, mensagemSemCredito(provedor), status, {
    repetivel: false,
    semCredito: true,
  });
}

async function erroDeResposta(resp: Response, c: ChamadaHttp): Promise<ErroProvedor> {
  const { provedor, chave, modelo } = c;
  const status = resp.status;
  let texto = '';
  try {
    texto = await resp.text();
  } catch (e) {
    if (foiCancelado(e, c.signal)) return erroProvedor('cancelado', provedor);
  }
  const corpo = lerCorpoDeErro(texto);
  const detalhe = sanitizar(corpo.mensagem, chave);

  if (status === 401 || status === 403) return erroProvedor('chave_invalida', provedor, { status });
  if (status === 429) {
    return PADRAO_COTA_ESGOTADA.test(corpo.pistas)
      ? erroSemCredito(provedor, status)
      : erroProvedor('limite', provedor, { status });
  }
  if (status >= 500 || status === 408) {
    return erroProvedor('instavel', provedor, { status, detalhe, repetivel: true });
  }
  // O Gemini devolve chave inválida como 400 INVALID_ARGUMENT, não como 401/403.
  if (PADRAO_CHAVE_INVALIDA.test(corpo.pistas)) {
    return erroProvedor('chave_invalida', provedor, { status });
  }
  if (PADRAO_SEM_CREDITO.test(corpo.pistas)) {
    return erroSemCredito(provedor, status);
  }
  // As mensagens específicas do modelo só valem em chamadas que têm um modelo (nunca no teste de chave).
  if (modelo !== undefined) {
    if (status === 413 || PADRAO_MUITO_LONGO.test(corpo.pistas)) {
      return erroProvedor('muito_longo', provedor, { status, modelo });
    }
    if (status === 404) {
      return new ErroProvedor(
        'parametro',
        provedor,
        `O modelo ${modelo} não foi encontrado neste provedor. Confira o nome nas configurações.`,
        status,
      );
    }
    if (
      (status === 400 || status === 422) &&
      (corpo.temParam || PADRAO_PARAMETRO.test(corpo.pistas))
    ) {
      return erroProvedor('parametro', provedor, { status, modelo });
    }
  }
  return erroProvedor('inesperado', provedor, { status, detalhe });
}

/**
 * Chamada única a um provedor: aplica as opções de privacidade do navegador, traduz falhas de
 * rede/HTTP em ErroProvedor e devolve o JSON do corpo de uma resposta 2xx.
 */
export async function chamarProvedor(c: ChamadaHttp): Promise<unknown> {
  if (c.signal.aborted) throw erroProvedor('cancelado', c.provedor);

  let resp: Response;
  try {
    resp = await fetch(c.url, {
      method: c.metodo,
      headers: c.headers,
      ...(c.corpo === undefined ? {} : { body: JSON.stringify(c.corpo) }),
      signal: c.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  } catch (e) {
    if (foiCancelado(e, c.signal)) throw erroProvedor('cancelado', c.provedor);
    throw e instanceof TypeError
      ? erroProvedor('rede', c.provedor)
      : erroProvedor('instavel', c.provedor, { repetivel: true });
  }

  if (!resp.ok) throw await erroDeResposta(resp, c);

  try {
    return await resp.json();
  } catch (e) {
    if (foiCancelado(e, c.signal)) throw erroProvedor('cancelado', c.provedor);
    throw erroProvedor('json_invalido', c.provedor);
  }
}

/** Texto da resposta do modelo → objeto validado contra o schema; qualquer desvio é json_invalido. */
export function interpretarSaida(texto: string, schema: JsonSchema, provedor: ProviderId): unknown {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw erroProvedor('json_invalido', provedor);
  }
  if (validarSchema(valor, schema).length > 0) throw erroProvedor('json_invalido', provedor);
  return valor;
}
