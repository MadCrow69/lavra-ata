import { RASCUNHO } from '../config/storage-keys';
import type { AtaDraft } from './draft';

const TONS = ['formal', 'conciso', 'detalhado'];

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validação mínima de formato: protege contra lixo, não contra adulteração. */
function ehRascunho(v: unknown): v is AtaDraft {
  if (!ehObjeto(v) || v.versao !== 1) return false;
  const { tipoId, tom, dados, pauta, participantes, transcricao, mapa, resultado } = v;
  return (
    typeof tipoId === 'string' &&
    typeof tom === 'string' &&
    TONS.includes(tom) &&
    ehObjeto(dados) &&
    Array.isArray(pauta) &&
    pauta.every((p) => typeof p === 'string') &&
    Array.isArray(participantes) &&
    participantes.every((p) => ehObjeto(p) && typeof p.id === 'string') &&
    typeof transcricao === 'string' &&
    (mapa === null || ehObjeto(mapa)) &&
    (resultado === null || ehObjeto(resultado))
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
    return ehRascunho(dado) ? dado : null;
  } catch {
    return null;
  }
}
