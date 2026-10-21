import { useEffect, useRef, type RefObject } from 'react';
import type { OpcoesCadeia } from '../ai/chain';
import { ErroProvedor } from '../ai/errors';
import { useKeys } from '../ai/KeysContext';
import { useOperacaoIA, type OperacaoIA } from './OperacaoIA';

/** O que fazer em cada desfecho de uma chamada. Nenhum é chamado para resultado tardio. */
export interface DesfechosDaChamada<T> {
  /** A vez foi reservada e a chamada vai sair (limpar avisos da tentativa anterior). */
  aoIniciar?: () => void;
  sucesso: (resultado: T) => void;
  /** A pessoa cancelou por aqui. */
  cancelado: () => void;
  /** Falhou (o rascunho não mudou). */
  erro: (e: unknown) => void;
}

export interface ChamadaIA {
  /** A operação de IA em andamento no app (desta instância ou de outra). */
  operacao: OperacaoIA | null;
  /** A operação em andamento é a desta instância. */
  ocupada: boolean;
  /**
   * Reserva a vez e chama `chamar` com o sinal de cancelamento. Resultado que chega depois de
   * cancelar, de "Nova ata" (interrompida por fora) ou de desmontar é descartado em silêncio.
   */
  executar: <T>(
    chamar: (signal: AbortSignal, opcoes: OpcoesCadeia) => Promise<T>,
    desfechos: DesfechosDaChamada<T>,
  ) => Promise<void>;
  /** Cancela a chamada desta instância (botão Cancelar). */
  cancelar: () => void;
  /** Botão Cancelar: recebe o foco quando a chamada começa. */
  cancelarRef: RefObject<HTMLButtonElement | null>;
}

function mesmaOperacao(a: OperacaoIA | null, b: OperacaoIA): boolean {
  if (a?.tipo !== b.tipo) return false;
  return a.tipo === 'ata' || (b.tipo === 'secao' && a.chave === b.chave);
}

/**
 * Ciclo de vida de uma chamada de IA, comum à barra de geração e às ações de seção: reserva a vez
 * em `useOperacaoIA`, distingue o cancelamento feito aqui da interrupção por fora, descarta o
 * resultado tardio, libera a vez no fim, cancela ao desmontar e cuida do foco (vai para Cancelar
 * no início e volta para `focoAoTerminar()` no fim, se ele se perdeu).
 *
 * Chave que o provedor recusar (401/403) é marcada como inválida no KeyStore, mesmo que outro
 * provedor responda: ela sai da fila e do cabeçalho, e o modal de chaves mostra o motivo (spec
 * 8.1.1). `opcoesCadeia` (testes) segue junto para a cadeia.
 */
export function useChamadaIA(
  alvo: OperacaoIA,
  focoAoTerminar: () => HTMLElement | null,
  opcoesCadeia?: OpcoesCadeia,
): ChamadaIA {
  const { operacao, iniciar, concluir, cancelar } = useOperacaoIA();
  const keys = useKeys();
  const ocupada = mesmaOperacao(operacao, alvo);
  /** Controle da chamada desta instância: distingue a minha operação da de outra e o resultado tardio. */
  const controleRef = useRef<AbortController | null>(null);
  /** Controle que a pessoa cancelou aqui; abortado sem isso = interrompido por fora ("Nova ata"). */
  const canceladoAquiRef = useRef<AbortController | null>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const focoRef = useRef(focoAoTerminar);
  useEffect(() => {
    focoRef.current = focoAoTerminar;
  });

  // Desmontar no meio da chamada a cancela (não sobra resultado tardio sobre uma tela que sumiu).
  useEffect(
    () => () => {
      const controle = controleRef.current;
      controleRef.current = null;
      controle?.abort();
    },
    [],
  );

  // O botão que iniciou a chamada fica parado: o foco vai para Cancelar e volta ao fim.
  const estavaOcupadaRef = useRef(false);
  useEffect(() => {
    if (ocupada) {
      cancelarRef.current?.focus();
    } else if (estavaOcupadaRef.current) {
      const ativo = document.activeElement;
      if (ativo === null || ativo === document.body) focoRef.current()?.focus();
    }
    estavaOcupadaRef.current = ocupada;
  }, [ocupada]);

  async function executar<T>(
    chamar: (signal: AbortSignal, opcoes: OpcoesCadeia) => Promise<T>,
    desfechos: DesfechosDaChamada<T>,
  ): Promise<void> {
    const controle = iniciar(alvo);
    if (controle === null) return;
    controleRef.current = controle;
    desfechos.aoIniciar?.();
    try {
      const r = await chamar(controle.signal, {
        ...opcoesCadeia,
        aoRecusarChave: (cfg) => {
          keys.definirEstado(cfg.id, cfg.chave, 'invalida');
        },
      });
      // Cancelada ou interrompida ("Nova ata") enquanto esperava: o resultado tardio é descartado.
      if (controleRef.current !== controle || controle.signal.aborted) return;
      desfechos.sucesso(r);
    } catch (e) {
      if (controleRef.current !== controle) return;
      // Interrompida por fora: a ata em que ela valia já não existe; nada a avisar aqui.
      if (controle.signal.aborted && canceladoAquiRef.current !== controle) return;
      if (e instanceof ErroProvedor && e.tipo === 'cancelado') desfechos.cancelado();
      else desfechos.erro(e);
    } finally {
      if (controleRef.current === controle) controleRef.current = null;
      concluir(controle);
    }
  }

  const cancelarAqui = () => {
    const controle = controleRef.current;
    if (!controle) return;
    canceladoAquiRef.current = controle;
    cancelar(controle);
  };

  return { operacao, ocupada, executar, cancelar: cancelarAqui, cancelarRef };
}
