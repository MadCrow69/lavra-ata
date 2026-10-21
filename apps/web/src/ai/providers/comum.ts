import { ROTULO_PROVEDOR } from '../../config/models';
import { ErroProvedor, erroProvedor, sanitizar } from '../errors';
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

function foiCancelado(e: unknown, signal: AbortSignal): boolean {
  // DOMException nem sempre herda de Error (jsdom), então confere só o `name`.
  return signal.aborted || (ehRegistro(e) && e.name === 'AbortError');
}

async function erroDeResposta(resp: Response, c: ChamadaHttp): Promise<ErroProvedor> {
  const { provedor, chave } = c;
  const status = resp.status;
  let texto = '';
  try {
    texto = await resp.text();
  } catch (e) {
    if (foiCancelado(e, c.signal)) return erroProvedor('cancelado', provedor);
  }
  let bruto = texto;
  try {
    const corpo: unknown = JSON.parse(texto);
    const erro = ehRegistro(corpo) ? corpo.error : undefined;
    if (ehRegistro(erro) && typeof erro.message === 'string') bruto = erro.message;
  } catch {
    // corpo não é JSON (página de proxy, por exemplo): usa o texto cru, sanitizado.
  }
  const detalhe = sanitizar(bruto, chave);

  if (status === 401 || status === 403) return erroProvedor('chave_invalida', provedor, { status });
  if (status === 429) return erroProvedor('limite', provedor, { status });
  if (status >= 500 || status === 408)
    return erroProvedor('instavel', provedor, { status, detalhe });
  if (PADRAO_SEM_CREDITO.test(bruto)) {
    return new ErroProvedor(
      'chave_invalida',
      provedor,
      `A conta de ${ROTULO_PROVEDOR[provedor]} está sem crédito ou saldo. Confira o saldo e a cobrança no painel do provedor.`,
      status,
    );
  }
  // 400/404/413/422…: o modelo ou algum valor enviado não foi aceito.
  return erroProvedor('parametro', provedor, {
    status,
    ...(c.modelo === undefined ? {} : { modelo: c.modelo }),
  });
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
    throw erroProvedor(e instanceof TypeError ? 'rede' : 'instavel', c.provedor);
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
