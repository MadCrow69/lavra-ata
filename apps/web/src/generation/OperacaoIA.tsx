import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Texto exibido em todo botão de IA parado porque outra operação de IA está em andamento. */
export const MOTIVO_IA_OCUPADA = 'Aguarde a geração em andamento terminar.';

/** O que está rodando: a ata inteira (barra de geração) ou uma seção (regerar/ajustar). */
export type OperacaoIA = { tipo: 'ata' } | { tipo: 'secao'; chave: string };

interface OperacaoIAApi {
  /** A operação em andamento; `null` = livre. */
  operacao: OperacaoIA | null;
  /** Reserva a vez. Devolve `null` (e não faz nada) se já há uma operação em andamento. */
  iniciar: (operacao: OperacaoIA) => AbortController | null;
  /** Libera a vez. Só vale para o controle que a reservou (um controle antigo não libera outro). */
  concluir: (controle: AbortController) => void;
  /**
   * Aborta a operação que `controle` reservou (um controle antigo não cancela a operação de
   * outro). A vez só é liberada quando quem a iniciou chamar `concluir`.
   */
  cancelar: (controle: AbortController) => void;
  /**
   * Aborta a operação em andamento, seja de quem for, e libera a vez na hora (ex.: "Nova ata").
   * Quem a iniciou descarta o resultado tardio; o `concluir` dele vira nada (o controle já não é o
   * da vez).
   */
  interromper: () => void;
}

const OperacaoIAContext = createContext<OperacaoIAApi | null>(null);

interface Ativa {
  operacao: OperacaoIA;
  controle: AbortController;
}

/**
 * Uma operação de IA por vez em todo o app. Cada chamada parte do mesmo mapa de mascaramento do
 * rascunho: duas em paralelo poderiam dar o mesmo marcador (ex.: `[CPF_3]`) a pessoas diferentes e
 * corromper a restauração dos dados nas próximas. O app todo (barra de geração e seções) pede a
 * vez aqui antes de chamar a IA.
 */
export function OperacaoIAProvider({ children }: { children: ReactNode }) {
  const [operacao, setOperacao] = useState<OperacaoIA | null>(null);
  // A recusa não pode esperar o próximo render: dois cliques na mesma rodada chegam aqui juntos.
  const ativaRef = useRef<Ativa | null>(null);

  const iniciar = useCallback((nova: OperacaoIA) => {
    if (ativaRef.current !== null) return null;
    const controle = new AbortController();
    ativaRef.current = { operacao: nova, controle };
    setOperacao(nova);
    return controle;
  }, []);

  const concluir = useCallback((controle: AbortController) => {
    if (ativaRef.current?.controle !== controle) return;
    ativaRef.current = null;
    setOperacao(null);
  }, []);

  const cancelar = useCallback((controle: AbortController) => {
    if (ativaRef.current?.controle !== controle) return;
    controle.abort();
  }, []);

  const interromper = useCallback(() => {
    const ativa = ativaRef.current;
    if (ativa === null) return;
    ativaRef.current = null;
    ativa.controle.abort();
    setOperacao(null);
  }, []);

  // Sair da tela no meio de uma chamada a cancela (o resultado tardio é descartado pelo pipeline).
  useEffect(
    () => () => {
      ativaRef.current?.controle.abort();
    },
    [],
  );

  const api = useMemo(
    () => ({ operacao, iniciar, concluir, cancelar, interromper }),
    [operacao, iniciar, concluir, cancelar, interromper],
  );
  return <OperacaoIAContext value={api}>{children}</OperacaoIAContext>;
}

export function useOperacaoIA(): OperacaoIAApi {
  const api = use(OperacaoIAContext);
  if (!api) throw new Error('useOperacaoIA precisa estar dentro de <OperacaoIAProvider>.');
  return api;
}
