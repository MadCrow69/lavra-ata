import { createContext, use, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { criarPreferenciasStore, type PreferenciasStore } from './preferencias-store';

const PreferenciasContext = createContext<PreferenciasStore | null>(null);

/** Dono do `PreferenciasStore` do app. Testes e o `App` injetam um `store`. */
export function PreferenciasProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: PreferenciasStore;
}) {
  const [instancia] = useState<PreferenciasStore>(() => store ?? criarPreferenciasStore());
  return <PreferenciasContext value={instancia}>{children}</PreferenciasContext>;
}

/** As preferências do app; quem usa re-renderiza a cada mudança (`versao` cresce). */
export function usePreferencias(): PreferenciasStore & { versao: number } {
  const store = use(PreferenciasContext);
  if (!store) {
    throw new Error('usePreferencias precisa estar dentro de <PreferenciasProvider>.');
  }
  const versao = useSyncExternalStore(store.assinar, store.revisao);
  return useMemo(() => ({ ...store, versao }), [store, versao]);
}
