import { EXEMPLO } from '../config/storage-keys';
import { storageOuNulo } from '../domain/storage-ou-nulo';

const VERSAO = 1;

/**
 * Tipo do exemplo que está no rascunho desta aba (marca do modo exemplo), ou `null`: sem marca,
 * storage bloqueado, JSON quebrado ou formato de outra versão. Nunca lança.
 */
export function lerExemploDaSessao(): string | null {
  const sessao = storageOuNulo('session');
  if (sessao === null) return null;
  try {
    const bruto = sessao.getItem(EXEMPLO);
    if (bruto === null) return null;
    const dado: unknown = JSON.parse(bruto);
    if (typeof dado !== 'object' || dado === null || Array.isArray(dado)) return null;
    const { versao, tipoId } = dado as Record<string, unknown>;
    return versao === VERSAO && typeof tipoId === 'string' && tipoId !== '' ? tipoId : null;
  } catch {
    return null;
  }
}

/** Grava a marca do modo exemplo (`null` apaga). Nunca lança (modo privado, cota cheia). */
export function gravarExemploNaSessao(tipoId: string | null): void {
  const sessao = storageOuNulo('session');
  if (sessao === null) return;
  try {
    if (tipoId === null) sessao.removeItem(EXEMPLO);
    else sessao.setItem(EXEMPLO, JSON.stringify({ versao: VERSAO, tipoId }));
  } catch {
    // Sem storage: o modo exemplo vale só até recarregar.
  }
}
