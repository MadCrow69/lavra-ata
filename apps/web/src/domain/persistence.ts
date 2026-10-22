import { RASCUNHO } from '../config/storage-keys';
import { ERRO_TIPOS, MOTIVOS_RECUSA, PROVEDORES, type ProviderId } from '../ai/types';
import {
  PRESENCAS,
  STATUS_ENCAMINHAMENTO,
  TIPOS_BLOCO,
  TONS,
  dadosDoVttValidos,
  ehDuracaoValida,
  type AtaDraft,
  type Atribuicao,
} from './draft';

type Obj = Record<string, unknown>;

function ehObjeto(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ehTexto(v: unknown): v is string {
  return typeof v === 'string';
}

function ehListaDeTexto(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(ehTexto);
}

function ehRegistro(v: unknown, valido: (x: unknown) => boolean): boolean {
  return ehObjeto(v) && Object.values(v).every(valido);
}

function ehUm<T extends string>(opcoes: readonly T[], v: unknown): v is T {
  return ehTexto(v) && (opcoes as readonly string[]).includes(v);
}

function ehNumero(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function ehParticipante(v: unknown): boolean {
  return (
    ehObjeto(v) &&
    ehTexto(v.id) &&
    ehTexto(v.nome) &&
    ehTexto(v.papel) &&
    ehUm(PRESENCAS, v.presenca) &&
    ehTexto(v.justificativa) &&
    ehRegistro(v.extras, ehTexto)
  );
}

function ehBloco(v: unknown): boolean {
  return ehObjeto(v) && ehUm(TIPOS_BLOCO, v.tipo) && ehTexto(v.texto) && ehListaDeTexto(v.itens);
}

function ehEncaminhamento(v: unknown): boolean {
  return (
    ehObjeto(v) &&
    ehTexto(v.acao) &&
    ehTexto(v.responsavel) &&
    ehTexto(v.prazo) &&
    ehUm(STATUS_ENCAMINHAMENTO, v.status)
  );
}

function ehFalhaAnterior(v: unknown): boolean {
  return (
    ehObjeto(v) &&
    ehUm(PROVEDORES, v.provedor) &&
    (v.erro === undefined || ehUm(ERRO_TIPOS, v.erro)) &&
    (v.motivo === undefined || ehUm(MOTIVOS_RECUSA, v.motivo))
  );
}

/** Formato de versão anterior: `fallbackDe` com quem falhou, sem o motivo. */
function ehFallbackAntigo(v: unknown): v is ProviderId[] {
  return Array.isArray(v) && v.every((p) => ehUm(PROVEDORES, p));
}

function ehAtribuicao(v: unknown): boolean {
  if (!ehObjeto(v) || !ehUm(PROVEDORES, v.provedor) || !ehTexto(v.modelo)) return false;
  return v.falhas === undefined
    ? ehFallbackAntigo(v.fallbackDe)
    : Array.isArray(v.falhas) && v.falhas.every(ehFalhaAnterior);
}

/** Atribuição de versão anterior (`fallbackDe`) vira `falhas` sem motivo; a atual passa intacta. */
function migrarAtribuicao(a: Atribuicao): Atribuicao {
  const bruto = a as unknown as Obj;
  if (bruto.falhas !== undefined || !ehFallbackAntigo(bruto.fallbackDe)) return a;
  return {
    provedor: a.provedor,
    modelo: a.modelo,
    falhas: bruto.fallbackDe.map((provedor) => ({ provedor })),
  };
}

function migrar(d: AtaDraft): AtaDraft {
  if (!d.resultado) return d;
  const atribuicao = Object.fromEntries(
    Object.entries(d.resultado.atribuicao).map(([chave, a]) => [chave, migrarAtribuicao(a)]),
  );
  return { ...d, resultado: { ...d.resultado, atribuicao } };
}

function ehResultado(v: unknown): boolean {
  return (
    ehObjeto(v) &&
    ehRegistro(v.secoes, (blocos) => Array.isArray(blocos) && blocos.every(ehBloco)) &&
    Array.isArray(v.encaminhamentos) &&
    v.encaminhamentos.every(ehEncaminhamento) &&
    ehRegistro(v.atribuicao, ehAtribuicao) &&
    ehRegistro(v.avisos, ehListaDeTexto) &&
    ehListaDeTexto(v.editadas)
  );
}

function ehMapa(v: unknown): boolean {
  return (
    ehObjeto(v) &&
    v.version === 1 &&
    ehRegistro(v.markers, ehTexto) &&
    ehRegistro(v.keys, ehTexto) &&
    ehRegistro(v.counters, ehNumero) &&
    (v.reserved === undefined || ehRegistro(v.reserved, ehListaDeTexto))
  );
}

/** Dados do .vtt salvos: lista de nomes, duração válida se houver e ao menos um dos dois. */
function ehVttSalvo(v: unknown): boolean {
  return (
    ehObjeto(v) &&
    ehListaDeTexto(v.falantes) &&
    (v.duracaoMin === undefined || ehDuracaoValida(v.duracaoMin)) &&
    dadosDoVttValidos(v) !== null
  );
}

/**
 * Valida o formato completo do rascunho recuperado: o que está no storage pode vir de
 * outra versão do app ou estar corrompido, e os renderers confiam no tipo.
 */
function ehRascunho(v: unknown): v is AtaDraft {
  return (
    ehObjeto(v) &&
    v.versao === 1 &&
    ehTexto(v.tipoId) &&
    ehUm(TONS, v.tom) &&
    ehRegistro(v.dados, ehTexto) &&
    ehListaDeTexto(v.pauta) &&
    Array.isArray(v.participantes) &&
    v.participantes.every(ehParticipante) &&
    ehTexto(v.transcricao) &&
    (v.vtt === undefined || ehVttSalvo(v.vtt)) &&
    (v.mapa === null || ehMapa(v.mapa)) &&
    (v.resultado === null || ehResultado(v.resultado))
  );
}

/** Grava o rascunho em `sessionStorage`. Nunca lança (modo privado, cota cheia). */
export function salvarRascunho(d: AtaDraft): void {
  try {
    sessionStorage.setItem(RASCUNHO, JSON.stringify(d));
  } catch {
    // Sem storage disponível: o rascunho segue só em memória.
  }
}

/** Lê o rascunho salvo. Ausente, ilegível ou de formato inesperado → `null`. */
export function carregarRascunho(): AtaDraft | null {
  try {
    const bruto = sessionStorage.getItem(RASCUNHO);
    if (bruto === null) return null;
    const dado: unknown = JSON.parse(bruto);
    return ehRascunho(dado) ? migrar(dado) : null;
  } catch {
    return null;
  }
}
