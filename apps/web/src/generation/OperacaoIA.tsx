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
import type { EnvioAutorizado } from './autorizacao';

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
   * A pessoa cancelou a operação em andamento, seja de quem for (ex.: o Cancelar da aba
   * Documento no celular, para a geração que a barra iniciou). Como `cancelar`: a vez só é
   * liberada quando quem a iniciou chamar `concluir`.
   */
  cancelarAtual: () => void;
  /** `controle` foi cancelado pela pessoa (`cancelar`/`cancelarAtual`), não interrompido por fora. */
  foiCancelada: (controle: AbortController) => boolean;
  /**
   * Aborta a operação em andamento, seja de quem for, e libera a vez na hora (ex.: "Nova ata").
   * Quem a iniciou descarta o resultado tardio; o `concluir` dele vira nada (o controle já não é o
   * da vez).
   */
  interromper: () => void;
  /**
   * A última revisão autorizada (compartilhada pela barra de geração e pelas seções). Lida na hora
   * da decisão, sem re-render: só em memória, nunca em storage.
   */
  autorizado: () => EnvioAutorizado | null;
  /** "Enviar" na revisão: guarda o que a pessoa autorizou. */
  autorizar: (envio: EnvioAutorizado) => void;
  /** "Cancelar" na revisão: o que estava autorizado deixa de valer (nada sai sem revisar de novo). */
  revogar: () => void;
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
 * vez aqui antes de chamar a IA. Guarda também a última revisão autorizada (`autorizacao.ts`), que
 * a barra e as seções consultam antes de enviar sem abrir a revisão.
 */
export function OperacaoIAProvider({ children }: { children: ReactNode }) {
  const [operacao, setOperacao] = useState<OperacaoIA | null>(null);
  // A recusa não pode esperar o próximo render: dois cliques na mesma rodada chegam aqui juntos.
  const ativaRef = useRef<Ativa | null>(null);
  const canceladasRef = useRef(new WeakSet<AbortController>());
  const autorizadoRef = useRef<EnvioAutorizado | null>(null);

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
    canceladasRef.current.add(controle);
    controle.abort();
  }, []);

  const cancelarAtual = useCallback(() => {
    const ativa = ativaRef.current;
    if (ativa) cancelar(ativa.controle);
  }, [cancelar]);

  const foiCancelada = useCallback(
    (controle: AbortController) => canceladasRef.current.has(controle),
    [],
  );

  const interromper = useCallback(() => {
    const ativa = ativaRef.current;
    if (ativa === null) return;
    ativaRef.current = null;
    ativa.controle.abort();
    setOperacao(null);
  }, []);

  const autorizado = useCallback(() => autorizadoRef.current, []);
  const autorizar = useCallback((envio: EnvioAutorizado) => {
    autorizadoRef.current = envio;
  }, []);
  const revogar = useCallback(() => {
    autorizadoRef.current = null;
  }, []);

  // Sair da tela no meio de uma chamada a cancela (o resultado tardio é descartado pelo pipeline).
  useEffect(
    () => () => {
      ativaRef.current?.controle.abort();
    },
    [],
  );

  const api = useMemo(
    () => ({
      operacao,
      iniciar,
      concluir,
      cancelar,
      cancelarAtual,
      foiCancelada,
      interromper,
      autorizado,
      autorizar,
      revogar,
    }),
    [
      operacao,
      iniciar,
      concluir,
      cancelar,
      cancelarAtual,
      foiCancelada,
      interromper,
      autorizado,
      autorizar,
      revogar,
    ],
  );
  return <OperacaoIAContext value={api}>{children}</OperacaoIAContext>;
}

export function useOperacaoIA(): OperacaoIAApi {
  const api = use(OperacaoIAContext);
  if (!api) throw new Error('useOperacaoIA precisa estar dentro de <OperacaoIAProvider>.');
  return api;
}
