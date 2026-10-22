import { storageOuNulo } from './storage-ou-nulo';

/**
 * Mecânica de guardar UM valor sob uma chave: `sessionStorage` sempre e `localStorage` só quando a
 * pessoa pede para lembrar. Não conhece o domínio: quem usa passa o validador (`ler`) e o
 * serializador. Nenhuma operação lança — cota cheia, modo privado e armazenamento bloqueado viram
 * `false` (gravar) ou "nada lido".
 */
export interface ArmazemLembravel<T> {
  /** Valor da abertura: o do local (espelhado na sessão) ou o da sessão. Inválido é apagado. */
  lido: T | null;
  /** O valor lido veio do `localStorage`. */
  lembrado: boolean;
  gravarSessao: (v: T) => boolean;
  gravarLocal: (v: T) => boolean;
  apagarSessao: () => void;
  apagarLocal: () => void;
}

function apagar(storage: Storage | null, chave: string): void {
  try {
    storage?.removeItem(chave);
  } catch {
    // Sem acesso ao armazenamento: nada a apagar.
  }
}

function gravar<T>(
  storage: Storage | null,
  chave: string,
  valor: T,
  serializar: (v: T) => string,
): boolean {
  try {
    if (storage === null) return false;
    storage.setItem(chave, serializar(valor));
    return true;
  } catch {
    // Cota cheia ou armazenamento bloqueado.
    return false;
  }
}

/** Lê e valida o que está no storage; o que for inválido é apagado de lá. */
function restaurar<T>(
  storage: Storage | null,
  chave: string,
  ler: (bruto: string) => T | null,
): T | null {
  if (storage === null) return null;
  try {
    const bruto = storage.getItem(chave);
    if (bruto === null) return null;
    const valor = ler(bruto);
    if (valor === null) apagar(storage, chave);
    return valor;
  } catch {
    return null;
  }
}

/**
 * `sessao`/`local`: `null` = sem esse armazenamento; `undefined` = o do navegador
 * (`storageOuNulo`). O valor lembrado vale mais que o da sessão e é espelhado nela, para que
 * desmarcar "Lembrar" e recarregar não traga de volta um valor mais velho que ficou nesta aba.
 */
export function criarArmazemLembravel<T>(
  chave: string,
  ler: (bruto: string) => T | null,
  serializar: (v: T) => string,
  sessao?: Storage | null,
  local?: Storage | null,
): ArmazemLembravel<T> {
  const alvoSessao = sessao === undefined ? storageOuNulo('session') : sessao;
  const alvoLocal = local === undefined ? storageOuNulo('local') : local;

  const doLocal = restaurar(alvoLocal, chave, ler);
  const daSessao = restaurar(alvoSessao, chave, ler);
  if (doLocal !== null) gravar(alvoSessao, chave, doLocal, serializar);

  return {
    lido: doLocal ?? daSessao,
    lembrado: doLocal !== null,
    gravarSessao: (v) => gravar(alvoSessao, chave, v, serializar),
    gravarLocal: (v) => gravar(alvoLocal, chave, v, serializar),
    apagarSessao: () => {
      apagar(alvoSessao, chave);
    },
    apagarLocal: () => {
      apagar(alvoLocal, chave);
    },
  };
}
