import { createContext, use, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { criarKeyStore, type KeyStore } from './keys';

const KeysContext = createContext<KeyStore | null>(null);

/** Dono do `KeyStore` do app. Testes injetam um `store` com storage falso. */
export function KeysProvider({ children, store }: { children: ReactNode; store?: KeyStore }) {
  const [instancia] = useState<KeyStore>(() => store ?? criarKeyStore());
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
