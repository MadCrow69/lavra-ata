import { useSyncExternalStore } from 'react';

/** Largura mínima (px) para exibir Editar e Documento lado a lado. */
export const LARGURA_DUAS_COLUNAS = 1024;

const CONSULTA = `(min-width: ${String(LARGURA_DUAS_COLUNAS)}px)`;

function assinar(aoMudar: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const lista = window.matchMedia(CONSULTA);
  lista.addEventListener('change', aoMudar);
  return () => {
    lista.removeEventListener('change', aoMudar);
  };
}

function lerAtual(): boolean {
  // Sem matchMedia (ambientes antigos), assume tela larga: ambos os painéis visíveis.
  return typeof window.matchMedia !== 'function' || window.matchMedia(CONSULTA).matches;
}

/** `true` quando a janela comporta duas colunas; reage a redimensionamento. */
export function useLarguraLarga(): boolean {
  return useSyncExternalStore(assinar, lerAtual, () => true);
}
