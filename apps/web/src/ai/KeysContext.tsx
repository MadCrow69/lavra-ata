import { createContext, use, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { criarKeyStore, type KeyStore } from './keys';
import type { ProviderId } from './types';

const KeysContext = createContext<KeyStore | null>(null);

/**
 * Dono do `KeyStore` do app. Testes injetam um `store` com storage falso. `ordemInicial` (ordem
 * lembrada nas preferências) só vale sem chaves lembradas e sem `store` injetado.
 */
export function KeysProvider({
  children,
  store,
  ordemInicial,
}: {
  children: ReactNode;
  store?: KeyStore;
  ordemInicial?: readonly ProviderId[];
}) {
  const [instancia] = useState<KeyStore>(() => store ?? criarKeyStore(undefined, ordemInicial));
  return <KeysContext value={instancia}>{children}</KeysContext>;
}

/** O `KeyStore` do app; quem usa re-renderiza a cada mudança (`versao` cresce). */
export function useKeys(): KeyStore & { versao: number } {
  const store = use(KeysContext);
  if (!store) {
    throw new Error('useKeys precisa estar dentro de <KeysProvider>.');
  }
  const versao = useSyncExternalStore(store.assinar, store.revisao);
  return useMemo(() => ({ ...store, versao }), [store, versao]);
}
