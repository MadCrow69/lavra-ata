import { createContext, use, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AtaDraft, DraftAction } from './draft';
import { criarRascunho, draftReducer } from './draft-reducer';

interface DraftContextValue {
  state: AtaDraft;
  dispatch: Dispatch<DraftAction>;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({
  children,
  inicial,
}: {
  children: ReactNode;
  /** Rascunho de partida (ex.: recuperado da sessão). */
  inicial?: AtaDraft;
}) {
  const [state, dispatch] = useReducer(draftReducer, inicial, (i) => i ?? criarRascunho());
  return <DraftContext value={{ state, dispatch }}>{children}</DraftContext>;
}

export function useDraft(): DraftContextValue {
  const ctx = use(DraftContext);
  if (!ctx) {
    throw new Error('useDraft precisa estar dentro de <DraftProvider>.');
  }
  return ctx;
}
