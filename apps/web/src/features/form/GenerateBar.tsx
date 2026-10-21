import { useEffect, useId, useRef, useState } from 'react';
import { camposFaltando, obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import { ErroCadeia, ErroProvedor, resumoDoErro } from '../../ai/errors';
import { useKeys } from '../../ai/KeysContext';
import { ROTULO_CURTO, ROTULO_PROVEDOR } from '../../config/models';
import { useDraft } from '../../domain/DraftContext';
import { CHAVE_AVISOS_GERAIS } from '../../domain/draft-reducer';
import { gerarAta } from '../../generation/pipeline';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { focarCampo } from './focar-campo';
import styles from './generate.module.css';

export interface GenerateBarProps {
  /** Abre o modal de chaves (sem chave, "Trocar" e erros que pedem outra chave ou modelo). */
  onConfigurarChaves: () => void;
  /** Substitui os adaptadores reais e a espera do retry (testes). */
  opcoesCadeia?: OpcoesCadeia;
}

type Estado =
  | { fase: 'parado' }
  | { fase: 'gerando' }
  | { fase: 'cancelado' }
  | { fase: 'erro'; titulo: string; detalhes: string[] };

const LISTA = new Intl.ListFormat('pt-BR', { type: 'conjunction' });

/** Erro como causa + ação, sem nunca repassar texto que não foi escrito por nós (chave, dados). */
function estadoDeErro(e: unknown): Estado {
  if (e instanceof ErroCadeia) {
    return e.falhas.length === 0
      ? { fase: 'erro', titulo: e.message, detalhes: [] }
      : {
          fase: 'erro',
          titulo: 'Nenhum provedor conseguiu gerar a ata.',
          detalhes: e.falhas.map((f) => `${ROTULO_PROVEDOR[f.provedor]}: ${f.mensagem}`),
        };
  }
  if (e instanceof ErroProvedor) {
    return { fase: 'erro', titulo: 'A ata não foi gerada.', detalhes: [e.message] };
  }
  return {
    fase: 'erro',
    titulo: 'A ata não foi gerada por um erro inesperado no aplicativo.',
    detalhes: [
      'Tente de novo. Se o erro continuar, troque de provedor nas configurações de chave.',
    ],
  };
}

/**
 * Barra de geração da ata: o que falta, para quem vai, progresso, cancelar, erro e confirmação
 * antes de substituir uma ata já gerada. O rascunho só muda no sucesso.
 */
export function GenerateBar({ onConfigurarChaves, opcoesCadeia }: GenerateBarProps) {
  const { state, dispatch } = useDraft();
  const keys = useKeys();
  const { mostrar } = useToast();
  const [estado, setEstado] = useState<Estado>({ fase: 'parado' });
  const [confirmando, setConfirmando] = useState(false);
  const controleRef = useRef<AbortController | null>(null);
  const gerarRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const resumoId = useId();

  const tipo = obterTipo(state.tipoId);
  const faltas = camposFaltando(state, tipo);
  // `useKeys` re-renderiza a cada mudança no KeyStore; a cadeia (até 3 itens) é lida a cada render.
  const cadeia = keys.cadeia();
  const gerando = estado.fase === 'gerando';
  const avisosGerais = state.resultado?.avisos[CHAVE_AVISOS_GERAIS] ?? [];

  // Desmontar no meio da geração cancela a chamada (e o resultado tardio é ignorado).
  useEffect(
    () => () => {
      const controle = controleRef.current;
      controleRef.current = null;
      controle?.abort();
    },
    [],
  );

  // O botão Gerar fica desabilitado durante a geração: o foco vai para Cancelar e volta ao fim.
  const estavaGerandoRef = useRef(false);
  useEffect(() => {
    if (gerando) cancelarRef.current?.focus();
    else if (estavaGerandoRef.current && !gerarRef.current?.disabled) {
      const ativo = document.activeElement;
      if (ativo === null || ativo === document.body) gerarRef.current?.focus();
    }
    estavaGerandoRef.current = gerando;
  }, [gerando]);

  /** Porta única de toda chamada (Gerar, confirmação e "Tentar de novo"): nada sai com falta. */
  const podeGerar = faltas.length === 0 && !gerando;

  const gerar = async () => {
    if (!podeGerar || controleRef.current !== null) return;
    if (cadeia.length === 0) {
      onConfigurarChaves();
      return;
    }
    const controle = new AbortController();
    controleRef.current = controle;
    setEstado({ fase: 'gerando' });
    try {
      const r = await gerarAta(state, tipo, cadeia, controle.signal, opcoesCadeia);
      if (controleRef.current !== controle) return;
      dispatch({ type: 'registrarResultado', resultado: r.resultado, mapa: r.mapa });
      setEstado({ fase: 'parado' });
      mostrar({
        titulo: `Ata gerada por ${ROTULO_CURTO[r.atribuicao.provedor]} · ${r.atribuicao.modelo}`,
        detalhes: r.falhas.map(
          (f) => `${ROTULO_CURTO[f.provedor]} falhou: ${resumoDoErro(f.erro)}`,
        ),
      });
    } catch (e) {
      if (controleRef.current !== controle) return;
      setEstado(
        e instanceof ErroProvedor && e.tipo === 'cancelado'
          ? { fase: 'cancelado' }
          : estadoDeErro(e),
      );
    } finally {
      if (controleRef.current === controle) controleRef.current = null;
    }
  };

  const aoClicarGerar = () => {
    if (!podeGerar) return;
    if (cadeia.length === 0) {
      onConfigurarChaves();
      return;
    }
    if (state.resultado) {
      setConfirmando(true);
      return;
    }
    void gerar();
  };

  const [primeiro, ...depois] = cadeia;

  return (
    <section className={styles.barra} aria-label="Gerar ata">
      {avisosGerais.length > 0 ? (
        <ul className={styles.avisos}>
          {avisosGerais.map((aviso) => (
            <li key={aviso}>
              <span aria-hidden="true">⚠ </span>
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.acoes}>
        <Button
          ref={gerarRef}
          variante="primario"
          disabled={!podeGerar}
          aria-describedby={faltas.length > 0 ? resumoId : undefined}
          onClick={aoClicarGerar}
        >
          <span aria-hidden="true">✨</span> Gerar ata
        </Button>
        {gerando ? (
          <Button
            ref={cancelarRef}
            onClick={() => {
              controleRef.current?.abort();
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>

      {faltas.length > 0 ? (
        <button
          type="button"
          id={resumoId}
          className={styles.falta}
          title="Ir para o primeiro campo pendente"
          onClick={() => {
            const primeira = faltas[0];
            if (primeira) focarCampo(primeira);
          }}
        >
          {`Falta: ${faltas.map((f) => f.rotulo).join(', ')}`}
        </button>
      ) : null}

      <p className={styles.destino}>
        {primeiro ? (
          <>
            {`Envia para ${ROTULO_CURTO[primeiro.id]} · ${primeiro.modelo}`}
            {depois.length > 0
              ? ` (depois ${LISTA.format(depois.map((c) => ROTULO_CURTO[c.id]))})`
              : ''}{' '}
            <button
              type="button"
              className={styles.link}
              aria-label="Trocar provedor ou modelo"
              onClick={onConfigurarChaves}
            >
              Trocar
            </button>
          </>
        ) : (
          'Nenhuma chave de IA configurada. Ao clicar em Gerar ata, você informa a sua.'
        )}
      </p>

      <div className={styles.status} aria-live="polite">
        {gerando ? (
          <>
            <progress className={styles.progresso} aria-label="Gerando a ata" />
            <p className={styles.statusTexto}>Gerando a ata — pode levar até 2 minutos.</p>
          </>
        ) : null}
        {estado.fase === 'cancelado' ? (
          <p className={styles.statusTexto}>Geração cancelada. A ata não foi alterada.</p>
        ) : null}
      </div>

      {estado.fase === 'erro' ? (
        <div role="alert" className={styles.erro}>
          <p className={styles.erroTitulo}>
            <span aria-hidden="true">⚠ </span>
            {estado.titulo}
          </p>
          {estado.detalhes.length > 0 ? (
            <ul className={styles.erroDetalhes}>
              {estado.detalhes.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          <p className={styles.erroDetalhes}>A ata não foi alterada.</p>
          <div className={styles.acoes}>
            <Button
              variante="primario"
              disabled={!podeGerar}
              aria-describedby={faltas.length > 0 ? resumoId : undefined}
              onClick={() => {
                void gerar();
              }}
            >
              Tentar de novo
            </Button>
            <Button onClick={onConfigurarChaves}>Configurar chaves</Button>
          </div>
        </div>
      ) : null}

      <Modal
        aberto={confirmando}
        titulo="Gerar a ata de novo?"
        onFechar={() => {
          setConfirmando(false);
        }}
        acoes={
          <>
            <Button
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              variante="primario"
              onClick={() => {
                setConfirmando(false);
                void gerar();
              }}
            >
              Gerar de novo
            </Button>
          </>
        }
      >
        <p>
          Gerar de novo substitui a ata atual, inclusive as seções editadas à mão. Para mudar só uma
          parte, use as ações da própria seção na folha.
        </p>
      </Modal>
    </section>
  );
}
