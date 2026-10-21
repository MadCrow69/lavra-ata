import { LOGO_BYTES_MAX_PNG, LOGO_SAIDA_MAX_PX } from '../config/logo';
import { LOGO } from '../config/storage-keys';
import type { LogoDoc } from '../document/model';
import { storageOuNulo } from '../domain/storage-ou-nulo';
import { bytesDoDataUrlPng, ehDataUrlPng } from './png-data-url';

export interface LogoStore {
  atual: () => LogoDoc | null;
  /** A logo está guardada em `localStorage` (sobrevive ao fechar a aba). */
  lembrar: () => boolean;
  /**
   * Passa a ser a logo atual. `persistiu: false` = o navegador não guardou (cota, modo privado):
   * a logo segue na memória, mas some ao recarregar. Nunca lança.
   */
  definir: (logo: LogoDoc) => { persistiu: boolean };
  /**
   * Marcar copia a logo atual para `localStorage` (recusado pelo navegador: `lembrar()` fica
   * false e `persistiu` é false). Desmarcar apaga de lá; a sessão e a memória ficam. Sem logo
   * não há o que lembrar: nada é gravado e `lembrar()` segue false.
   */
  definirLembrar: (v: boolean) => { persistiu: boolean };
  /** Apaga a logo da memória e dos dois storages. */
  remover: () => void;
}

const VERSAO = 1;

const numeroNaCaixa = (v: unknown, maximo: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= maximo;

/** Lê e valida o JSON gravado; qualquer defeito (formato, tipo de imagem, tamanho) → `null`. */
function lerLogo(bruto: string | null): LogoDoc | null {
  if (bruto === null) return null;
  let dado: unknown;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (typeof dado !== 'object' || dado === null || Array.isArray(dado)) return null;
  const { versao, dataUrl, largura, altura } = dado as Record<string, unknown>;
  if (versao !== VERSAO) return null;
  if (!ehDataUrlPng(dataUrl) || bytesDoDataUrlPng(dataUrl) > LOGO_BYTES_MAX_PNG) return null;
  if (!numeroNaCaixa(largura, LOGO_SAIDA_MAX_PX.largura)) return null;
  if (!numeroNaCaixa(altura, LOGO_SAIDA_MAX_PX.altura)) return null;
  return { dataUrl, largura, altura };
}

const serializar = (logo: LogoDoc): string =>
  JSON.stringify({
    versao: VERSAO,
    dataUrl: logo.dataUrl,
    largura: logo.largura,
    altura: logo.altura,
  });

function apagar(storage: Storage | null): void {
  try {
    storage?.removeItem(LOGO);
  } catch {
    // Sem acesso ao armazenamento: nada a apagar.
  }
}

function gravar(storage: Storage | null, logo: LogoDoc): boolean {
  try {
    if (storage === null) return false;
    storage.setItem(LOGO, serializar(logo));
    return true;
  } catch {
    // Cota cheia ou armazenamento bloqueado.
    return false;
  }
}

/** Lê a logo do storage; o que estiver lá e for inválido é apagado. */
function restaurar(storage: Storage | null): LogoDoc | null {
  if (storage === null) return null;
  try {
    const logo = lerLogo(storage.getItem(LOGO));
    if (logo === null) apagar(storage);
    return logo;
  } catch {
    return null;
  }
}

/**
 * Guarda a logo da organização: na memória, no `sessionStorage` (sobrevive a recarregar) e, só com
 * "Lembrar", no `localStorage`. `null` = sem esse armazenamento; `undefined` = o do navegador.
 * A logo nunca entra no rascunho da ata. Nunca lança por falha de armazenamento.
 */
export function criarLogoStore(sessao?: Storage | null, local?: Storage | null): LogoStore {
  const alvoSessao = sessao === undefined ? storageOuNulo('session') : sessao;
  const alvoLocal = local === undefined ? storageOuNulo('local') : local;

  const doLocal = restaurar(alvoLocal);
  const daSessao = restaurar(alvoSessao);
  let atual: LogoDoc | null = doLocal ?? daSessao;
  let lembrar = doLocal !== null;

  return {
    atual: () => atual,
    lembrar: () => lembrar,
    definir(logo) {
      atual = logo;
      const naSessao = gravar(alvoSessao, logo);
      if (!lembrar) return { persistiu: naSessao };
      const noLocal = gravar(alvoLocal, logo);
      // O local recusou: a logo deixa de ser "lembrada" (o que está lá é a versão anterior).
      if (!noLocal) {
        lembrar = false;
        apagar(alvoLocal);
      }
      return { persistiu: naSessao && noLocal };
    },
    definirLembrar(v) {
      if (!v) {
        lembrar = false;
        apagar(alvoLocal);
        return { persistiu: true };
      }
      if (atual === null) return { persistiu: alvoLocal !== null };
      lembrar = gravar(alvoLocal, atual);
      return { persistiu: lembrar };
    },
    remover() {
      atual = null;
      lembrar = false;
      apagar(alvoSessao);
      apagar(alvoLocal);
    },
  };
}
