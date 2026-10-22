import { normalizarOrdem } from '../ai/keys';
import { PROVEDORES, type ProviderId } from '../ai/types';
import { ATA_TYPES } from '../ata-types/registry';
import { ehIdDestaque, type IdDestaque } from '../config/destaque';
import { PREFERENCIAS } from '../config/storage-keys';
import { criarArmazemLembravel } from '../domain/armazem-lembravel';
import { TONS, type Tom } from '../domain/draft';

/**
 * O que o navegador pode lembrar entre visitas: escolhas de configuração, nunca conteúdo da ata.
 * Formato gravado: `{ versao: 1, tipoId?, tom?, destaque?, ordem?, modelos? }`.
 */
export interface Preferencias {
  tipoId?: string;
  tom?: Tom;
  destaque?: IdDestaque;
  ordem?: ProviderId[];
  modelos?: Partial<Record<ProviderId, string>>;
}

/** Campos que podem ser gravados — lista FECHADA (nada fora dela chega ao storage). */
export const CAMPOS_PREFERENCIAS: readonly (keyof Preferencias)[] = [
  'tipoId',
  'tom',
  'destaque',
  'ordem',
  'modelos',
];

export interface PreferenciasStore {
  atual: () => Preferencias;
  lembrar: () => boolean;
  /** Mescla na memória; grava na sessão sempre e no local se `lembrar`. Nunca lança. */
  definir: (parcial: Preferencias) => { persistiu: boolean };
  /** Marcar copia o atual para o local (recusado → lembrar false, persistiu false). Desmarcar apaga do local. */
  definirLembrar: (v: boolean) => { persistiu: boolean };
  /** "Esquecer preferências": apaga do local, lembrar false; memória e sessão ficam (valem nesta aba). */
  esquecer: () => void;
  assinar: (ouvinte: () => void) => () => void;
  revisao: () => number;
}

const VERSAO = 1;

function ehProvedor(v: unknown): v is ProviderId {
  return typeof v === 'string' && (PROVEDORES as readonly string[]).includes(v);
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Um validador por campo: devolve o valor limpo, ou `undefined` (campo inválido some). */
const VALIDADORES: { [K in keyof Preferencias]-?: (v: unknown) => Preferencias[K] | undefined } = {
  tipoId: (v) => (typeof v === 'string' && Object.hasOwn(ATA_TYPES, v) ? v : undefined),
  tom: (v) => TONS.find((t) => t === v),
  destaque: (v) => (ehIdDestaque(v) ? v : undefined),
  // Sem nenhum provedor conhecido a lista não diz nada: vira "sem preferência".
  ordem: (v) =>
    Array.isArray(v) && (v as unknown[]).some(ehProvedor)
      ? normalizarOrdem(v as unknown[])
      : undefined,
  modelos: (v) => {
    if (!ehObjeto(v)) return undefined;
    const limpos: Partial<Record<ProviderId, string>> = {};
    for (const p of PROVEDORES) {
      const m = v[p];
      if (typeof m === 'string' && m.trim() !== '') limpos[p] = m.trim();
    }
    return Object.keys(limpos).length > 0 ? limpos : undefined;
  },
};

/**
 * Valida campo a campo e devolve SÓ os campos de `CAMPOS_PREFERENCIAS`, já válidos. É o único
 * portão: serve à leitura do storage, ao `definir` e à serialização.
 */
function limpar(bruto: unknown): Preferencias {
  const saida: Record<string, unknown> = {};
  if (!ehObjeto(bruto)) return saida;
  for (const campo of CAMPOS_PREFERENCIAS) {
    const valor = VALIDADORES[campo](bruto[campo]);
    if (valor !== undefined) saida[campo] = valor;
  }
  return saida;
}

function copiar(p: Preferencias): Preferencias {
  return limpar(JSON.parse(JSON.stringify(p)));
}

function lerPreferencias(bruto: string): Preferencias | null {
  let dado: unknown;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (!ehObjeto(dado) || dado.versao !== VERSAO) return null;
  return limpar(dado);
}

const serializar = (p: Preferencias): string => JSON.stringify({ versao: VERSAO, ...limpar(p) });

/**
 * Preferências do navegador: na memória, no `sessionStorage` (sobrevive a recarregar a aba) e, só
 * com "Lembrar", no `localStorage`. `null` = sem esse armazenamento; `undefined` = o do navegador.
 * Nunca guarda transcrição, resultado, participantes nem chaves de IA. Nunca lança.
 */
export function criarPreferenciasStore(
  sessao?: Storage | null,
  local?: Storage | null,
): PreferenciasStore {
  const armazem = criarArmazemLembravel(PREFERENCIAS, lerPreferencias, serializar, sessao, local);
  let atual: Preferencias = armazem.lido ?? {};
  let lembrar = armazem.lembrado;
  let revisao = 0;
  const ouvintes = new Set<() => void>();

  const mudou = (): void => {
    revisao++;
    for (const ouvinte of [...ouvintes]) ouvinte();
  };

  return {
    atual: () => copiar(atual),
    lembrar: () => lembrar,
    definir(parcial) {
      const novo = limpar(parcial);
      atual = limpar({
        ...atual,
        ...novo,
        ...(novo.modelos ? { modelos: { ...atual.modelos, ...novo.modelos } } : {}),
      });
      const naSessao = armazem.gravarSessao(atual);
      let persistiu = naSessao;
      if (lembrar) {
        const noLocal = armazem.gravarLocal(atual);
        // O local recusou: deixa de ser "lembrado" (o que está lá é a versão anterior).
        if (!noLocal) {
          lembrar = false;
          armazem.apagarLocal();
        }
        persistiu = naSessao && noLocal;
      }
      mudou();
      return { persistiu };
    },
    definirLembrar(v) {
      let persistiu: boolean;
      if (v) {
        lembrar = armazem.gravarLocal(atual);
        persistiu = lembrar;
      } else {
        lembrar = false;
        armazem.apagarLocal();
        // A sessão passa a ser a única cópia: tem de ser a atual, não uma mais velha.
        persistiu = armazem.gravarSessao(atual);
      }
      mudou();
      return { persistiu };
    },
    esquecer() {
      lembrar = false;
      armazem.apagarLocal();
      mudou();
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    revisao: () => revisao,
  };
}
