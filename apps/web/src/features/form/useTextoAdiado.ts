import { useEffect, useState } from 'react';

/**
 * Devolve `texto` depois de `esperaMs` sem mudança. Serve a uma região `aria-live`: o leitor de
 * tela anuncia o texto vigente quando a pessoa para de mexer, e não a cada tecla. O valor inicial
 * é o próprio `texto` (nada a anunciar de novo ao montar).
 */
export function useTextoAdiado<T extends string | null | undefined>(texto: T, esperaMs: number): T {
  const [adiado, setAdiado] = useState(texto);
  useEffect(() => {
    if (adiado === texto) return;
    const timer = setTimeout(() => {
      setAdiado(texto);
    }, esperaMs);
    return () => {
      clearTimeout(timer);
    };
  }, [texto, adiado, esperaMs]);
  return adiado;
}
