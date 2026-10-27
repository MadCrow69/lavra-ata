import { useEffect, useState } from 'react';

/**
 * Módulo carregado por `import()` só quando a tela precisa dele (fora da carga inicial; o
 * `check-bundle` mede). Uma promessa por vez; se falhar (offline, deploy novo com outro hash), a
 * próxima tentativa importa de novo.
 */
export interface ModuloSobDemanda<T> {
  /** O módulo, se já carregou; `null` antes disso. */
  obter: () => T | null;
  /** Carrega (ou devolve a carga em andamento). Pré-carga: chamar no hover/foco de quem abre. */
  carregar: () => Promise<T>;
}

export function sobDemanda<T>(importar: () => Promise<T>): ModuloSobDemanda<T> {
  let modulo: T | null = null;
  let promessa: Promise<T> | null = null;
  return {
    obter: () => modulo,
    carregar: () =>
      (promessa ??= importar().then(
        (m) => (modulo = m),
        (e: unknown) => {
          promessa = null;
          throw e;
        },
      )),
  };
}

/** Pré-carga silenciosa (hover/foco): a falha só aparece quando a pessoa realmente abrir. */
export function preCarregar<T>(modulo: ModuloSobDemanda<T>): void {
  modulo.carregar().catch(() => undefined);
}

/**
 * Carrega o módulo enquanto o componente estiver montado. Devolve o módulo (ou `null` enquanto
 * carrega), se falhou e como tentar de novo. Monte o componente só quando a tela abrir: a falha
 * recomeça a cada abertura.
 */
export function useSobDemanda<T>(mod: ModuloSobDemanda<T>): {
  modulo: T | null;
  falhou: boolean;
  tentarDeNovo: () => void;
} {
  const [modulo, setModulo] = useState<T | null>(() => mod.obter());
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (modulo !== null || falhou) return;
    let vivo = true;
    mod.carregar().then(
      (m) => {
        if (vivo) setModulo(m);
      },
      () => {
        if (vivo) setFalhou(true);
      },
    );
    return () => {
      vivo = false;
    };
  }, [mod, modulo, falhou]);

  return {
    modulo,
    falhou,
    tentarDeNovo: () => {
      setFalhou(false);
    },
  };
}
