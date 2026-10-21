import { useCallback, useSyncExternalStore } from 'react';

/**
 * `true` enquanto a consulta de mídia casa; reage a redimensionamento. Sem `matchMedia`
 * (ambientes antigos, testes), devolve `semSuporte`.
 */
export function useConsultaMidia(consulta: string, semSuporte: boolean): boolean {
  const assinar = useCallback(
    (aoMudar: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', aoMudar);
      return () => {
        lista.removeEventListener('change', aoMudar);
      };
    },
    [consulta],
  );
  const lerAtual = () =>
    typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : semSuporte;
  return useSyncExternalStore(assinar, lerAtual, () => semSuporte);
}
