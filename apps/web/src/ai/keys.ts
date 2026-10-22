import { MODELOS } from '../config/models';
import { CHAVES } from '../config/storage-keys';
import { storageOuNulo } from '../domain/storage-ou-nulo';
import { PROVEDORES, type MotivoRecusa, type ProviderConfig, type ProviderId } from './types';

export interface ChaveProvedor {
  provedor: ProviderId;
  chave: string;
  modelo: string;
  estado: 'nao_testada' | 'ok' | 'invalida';
  /**
   * Só na memória (como `estado`): por que a chave foi recusada, quando não é por estar errada
   * (sem crédito, sem workspace). Só vale com `estado === 'invalida'`.
   */
  motivo?: MotivoRecusa;
}

export interface KeyStore {
  /** Provedores com chave, na ordem de preferência. */
  listar: () => ChaveProvedor[];
  /** Ordem de preferência dos três provedores (tenham chave ou não). */
  ordem: () => ProviderId[];
  /** Grava (ou troca) a chave e o modelo do provedor. Chave vazia equivale a `remover`. */
  definir: (c: ChaveProvedor) => void;
  /**
   * Grava só o veredito do teste. Não faz nada se a chave guardada para o provedor já não é a que
   * foi testada (a pessoa a trocou durante o teste); nunca mexe no modelo escolhido.
   */
  definirEstado: (
    p: ProviderId,
    chave: string,
    estado: ChaveProvedor['estado'],
    motivo?: MotivoRecusa,
  ) => void;
  remover: (p: ProviderId) => void;
  reordenar: (ordem: ProviderId[]) => void;
  lembrar: () => boolean;
  /**
   * Marcar testa a gravação e salva as chaves atuais em `localStorage`; se o navegador bloquear,
   * `lembrar()` continua false e `persistenciaIndisponivel()` vira true. Desmarcar apaga de lá
   * (a memória fica).
   *
   * `CHAVES` guarda as chaves e a preferência junto: ao remover a última chave o item some, e com
   * ele a preferência "Lembrar" (na próxima visita volta desmarcada).
   */
  definirLembrar: (v: boolean) => void;
  /** O navegador recusou gravar em `localStorage`: a chave fica só na memória desta aba. */
  persistenciaIndisponivel: () => boolean;
  /**
   * Cadeia de geração: só provedores com chave, na ordem de preferência. Chave que o provedor já
   * recusou (`estado === 'invalida'`) fica de fora; editar a chave a devolve à cadeia.
   */
  cadeia: () => ProviderConfig[];
  /** Limpa memória e armazenamento e desliga "lembrar". */
  apagarTudo: () => void;
  /** Avisa a cada mudança (para `useSyncExternalStore`). Devolve o cancelamento. */
  assinar: (ouvinte: () => void) => () => void;
  /** Contador que cresce a cada mudança (instantâneo para `useSyncExternalStore`). */
  revisao: () => number;
}

/** Forma gravada em `localStorage`. O estado do teste não é gravado (volta a "não testada"). */
interface Persistido {
  chaves: { provedor: ProviderId; chave: string; modelo: string }[];
  ordem: ProviderId[];
}

function ehProvedor(v: unknown): v is ProviderId {
  return typeof v === 'string' && (PROVEDORES as readonly string[]).includes(v);
}

/** Ordem válida: ids conhecidos, sem repetição; o que faltar entra no fim na ordem padrão. */
export function normalizarOrdem(ordem: readonly unknown[]): ProviderId[] {
  const vistos = new Set<ProviderId>();
  for (const p of ordem) if (ehProvedor(p)) vistos.add(p);
  for (const p of PROVEDORES) vistos.add(p);
  return [...vistos];
}

function modeloOuPadrao(provedor: ProviderId, modelo: string): string {
  const limpo = modelo.trim();
  return limpo === '' ? MODELOS[provedor].padrao : limpo;
}

/** Lê e valida o JSON gravado. Qualquer defeito vira "vazio" (ou aproveita só as entradas boas). */
function lerPersistido(bruto: string | null): Persistido | null {
  if (bruto === null) return null;
  let dado: unknown;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (typeof dado !== 'object' || dado === null || Array.isArray(dado)) return null;
  const { chaves, ordem } = dado as { chaves?: unknown; ordem?: unknown };
  if (!Array.isArray(chaves)) return null;
  const validas: Persistido['chaves'] = [];
  for (const item of chaves as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { provedor, chave, modelo } = item as Record<string, unknown>;
    if (!ehProvedor(provedor) || typeof chave !== 'string' || chave.trim() === '') continue;
    if (typeof modelo !== 'string') continue;
    validas.push({ provedor, chave: chave.trim(), modelo: modeloOuPadrao(provedor, modelo) });
  }
  if (validas.length === 0) return null;
  return { chaves: validas, ordem: normalizarOrdem(Array.isArray(ordem) ? ordem : []) };
}

/** Ordem de partida dos provedores: a lista ou uma função que a devolve (lida a cada vez). */
export type OrdemInicial = readonly ProviderId[] | (() => readonly ProviderId[] | undefined);

/**
 * Guarda as chaves de API na memória da página. Só vão para `storage` (por padrão
 * `localStorage`) quando a pessoa marca "Lembrar neste navegador". `null` = nunca persiste.
 * `ordemInicial` (preferência lembrada) define a ordem de partida quando não há chaves lembradas.
 * Nunca registra a chave em log nem lança por falha de armazenamento.
 */
export function criarKeyStore(storage?: Storage | null, ordemInicial?: OrdemInicial): KeyStore {
  const alvo = storage === undefined ? storageOuNulo('local') : storage;
  const chaves = new Map<ProviderId, ChaveProvedor>();
  // Preferência lembrada de ordem: só vale sem chaves lembradas (a ordem gravada com elas vence).
  // Lida de novo em `apagarTudo`: vale a preferência de AGORA, não a da abertura.
  const ordemBase = (): ProviderId[] => {
    const base = typeof ordemInicial === 'function' ? ordemInicial() : ordemInicial;
    return base ? normalizarOrdem(base) : [...PROVEDORES];
  };
  let ordem: ProviderId[] = ordemBase();
  let lembrar = false;
  let bloqueado = false;
  let revisao = 0;
  const ouvintes = new Set<() => void>();

  /** Grava o conteúdo atual, se "lembrar" estiver ligado (único portão de escrita no storage). */
  const gravar = (): void => {
    if (!alvo || !lembrar) return;
    try {
      if (chaves.size === 0) alvo.removeItem(CHAVES);
      else alvo.setItem(CHAVES, JSON.stringify(conteudo()));
      bloqueado = false;
    } catch {
      // Armazenamento bloqueado ou cheio: as chaves seguem só na memória.
      bloqueado = true;
    }
  };

  const conteudo = (): Persistido => ({
    ordem,
    chaves: listar().map(({ provedor, chave, modelo }) => ({ provedor, chave, modelo })),
  });

  const apagarGravado = (): void => {
    try {
      alvo?.removeItem(CHAVES);
    } catch {
      // Sem acesso ao armazenamento: nada a apagar.
    }
  };

  const mudou = (): void => {
    revisao++;
    gravar();
    for (const ouvinte of [...ouvintes]) ouvinte();
  };

  function remover(p: ProviderId): void {
    if (chaves.delete(p)) mudou();
  }

  function listar(): ChaveProvedor[] {
    return ordem.flatMap((p) => {
      const c = chaves.get(p);
      return c ? [{ ...c }] : [];
    });
  }

  try {
    const lido = lerPersistido(alvo ? alvo.getItem(CHAVES) : null);
    if (lido) {
      for (const c of lido.chaves) {
        chaves.set(c.provedor, { ...c, estado: 'nao_testada' });
      }
      ordem = lido.ordem;
      lembrar = true;
    }
  } catch {
    // Leitura bloqueada: começa vazio.
  }

  return {
    listar,
    ordem: () => [...ordem],
    definir(c) {
      const chave = c.chave.trim();
      if (chave === '') {
        remover(c.provedor);
        return;
      }
      chaves.set(c.provedor, {
        provedor: c.provedor,
        chave,
        modelo: modeloOuPadrao(c.provedor, c.modelo),
        estado: c.estado,
        ...(c.estado === 'invalida' && c.motivo !== undefined ? { motivo: c.motivo } : {}),
      });
      mudou();
    },
    definirEstado(p, chave, estado, motivo) {
      const c = chaves.get(p);
      const motivoNovo = estado === 'invalida' ? motivo : undefined;
      if (c?.chave !== chave.trim()) return;
      if (c.estado === estado && c.motivo === motivoNovo) return;
      c.estado = estado;
      if (motivoNovo !== undefined) c.motivo = motivoNovo;
      else delete c.motivo;
      mudou();
    },
    remover,
    reordenar(nova) {
      ordem = normalizarOrdem(nova);
      mudou();
    },
    lembrar: () => lembrar,
    definirLembrar(v) {
      if (v === lembrar) return;
      if (v) {
        // Grava mesmo sem chaves: é o teste de que o navegador aceita escrever.
        try {
          if (!alvo) throw new Error('sem armazenamento');
          alvo.setItem(CHAVES, JSON.stringify(conteudo()));
          lembrar = true;
          bloqueado = false;
        } catch {
          lembrar = false;
          bloqueado = true;
        }
      } else {
        lembrar = false;
        bloqueado = false;
        apagarGravado();
      }
      revisao++;
      for (const ouvinte of [...ouvintes]) ouvinte();
    },
    persistenciaIndisponivel: () => bloqueado,
    cadeia: () =>
      listar()
        .filter((c) => c.estado !== 'invalida')
        .map((c) => ({ id: c.provedor, modelo: c.modelo, chave: c.chave })),
    apagarTudo() {
      chaves.clear();
      ordem = ordemBase();
      lembrar = false;
      bloqueado = false;
      apagarGravado();
      revisao++;
      for (const ouvinte of [...ouvintes]) ouvinte();
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
