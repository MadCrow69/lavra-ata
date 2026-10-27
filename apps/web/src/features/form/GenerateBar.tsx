import { useId, useMemo, useRef, useState } from 'react';
import { camposFaltando, obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import type { ProviderConfig } from '../../ai/types';
import { useKeys } from '../../ai/KeysContext';
import { ROTULO_CURTO } from '../../config/models';
import { useDraft } from '../../domain/DraftContext';
import type { ResultadoAta } from '../../domain/draft';
import { textoDaFalha } from '../../generation/atribuicao';
import { descreverErroDeGeracao } from '../../generation/erro-geracao';
import { MOTIVO_IA_OCUPADA } from '../../generation/OperacaoIA';
import { gerarAta, previaDoEnvio } from '../../generation/pipeline';
import { useChamadaIA } from '../../generation/useChamadaIA';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { MOTIVO_EXEMPLO, useModoExemplo } from '../exemplo/ModoExemplo';
import { RevisaoDoEnvio } from '../privacy/RevisaoDoEnvio';
import { focarCampo } from './focar-campo';
import styles from './generate.module.css';

export interface GenerateBarProps {
  /** Abre o modal de chaves (sem chave, "Trocar" e erros que pedem outra chave ou modelo). */
  onConfigurarChaves: () => void;
  /** Substitui os adaptadores reais e a espera do retry (testes). */
  opcoesCadeia?: OpcoesCadeia;
  /** A ata nova entrou no rascunho (a bancada leva a pessoa até a folha). */
  onGerada?: () => void;
  /** A geração falhou (a bancada mostra a barra, onde estão o erro e "Tentar de novo"). */
  onFalhou?: () => void;
}

type Estado =
  { fase: 'parado' } | { fase: 'cancelado' } | { fase: 'erro'; titulo: string; detalhes: string[] };

const LISTA = new Intl.ListFormat('pt-BR', { type: 'conjunction' });

function estadoDeErro(e: unknown): Estado {
  return { fase: 'erro', ...descreverErroDeGeracao(e, 'ata') };
}

/** O que a pessoa autorizou na última revisão: o conteúdo exato e os destinos (provedor + modelo). */
interface EnvioAutorizado {
  usuario: string;
  destinos: readonly string[];
}

const destinoDe = (c: ProviderConfig): string => `${c.id}:${c.modelo}`;

/**
 * Barra de geração da ata: o que falta, para quem vai, progresso, cancelar e erro. "Gerar ata"
 * nunca envia direto: abre a revisão do pedido exato (`RevisaoDoEnvio`, que também avisa quando a
 * ata atual será substituída) e só "Enviar" chama a IA. O rascunho só muda no sucesso.
 */
export function GenerateBar({
  onConfigurarChaves,
  opcoesCadeia,
  onGerada,
  onFalhou,
}: GenerateBarProps) {
  const { state, dispatch } = useDraft();
  const keys = useKeys();
  const { mostrar } = useToast();
  const [estado, setEstado] = useState<Estado>({ fase: 'parado' });
  const [revisando, setRevisando] = useState(false);
  /** Última revisão autorizada ("Tentar de novo" só pula a revisão se nada mudou desde ela). */
  const autorizadoRef = useRef<EnvioAutorizado | null>(null);
  const gerarRef = useRef<HTMLButtonElement>(null);
  /** A ata como estava quando a última tentativa saiu (para saber se algo mudou desde então). */
  const baseDaTentativaRef = useRef<ResultadoAta | null>(null);
  // O botão Gerar fica desabilitado durante a geração: o foco vai para Cancelar e volta ao fim.
  const chamada = useChamadaIA({ tipo: 'ata' }, () => gerarRef.current, opcoesCadeia);
  const { operacao, ocupada: gerando, cancelarRef } = chamada;
  const resumoId = useId();
  const ocupadaId = useId();
  const exemploId = useId();
  const noExemplo = useModoExemplo().tipoId !== null;

  const tipo = obterTipo(state.tipoId);
  const faltas = camposFaltando(state, tipo);
  // `useKeys` re-renderiza a cada mudança no KeyStore; a cadeia (até 3 itens) é lida a cada render.
  const cadeia = keys.cadeia();
  const ocupadaPorSecao = operacao !== null && !gerando;
  // Montado do MESMO rascunho que `gerar` envia neste render: o revisado é o enviado.
  const previa = useMemo(
    () => (revisando ? previaDoEnvio(state, obterTipo(state.tipoId)) : null),
    [revisando, state],
  );

  /**
   * Porta única de toda chamada (Gerar, "Enviar" da revisão e "Tentar de novo"): nada sai com falta
   * nem do modo exemplo (lá nada é enviado para IA).
   */
  const podeGerar = !noExemplo && faltas.length === 0 && operacao === null;

  const gerar = async () => {
    if (!podeGerar) return;
    if (cadeia.length === 0) {
      onConfigurarChaves();
      return;
    }
    await chamada.executar((signal, opcoes) => gerarAta(state, tipo, cadeia, signal, opcoes), {
      aoIniciar: () => {
        baseDaTentativaRef.current = state.resultado;
        setEstado({ fase: 'parado' });
      },
      sucesso: (r) => {
        dispatch({ type: 'registrarResultado', resultado: r.resultado, mapa: r.mapa });
        setEstado({ fase: 'parado' });
        mostrar({
          titulo: `Ata gerada por ${ROTULO_CURTO[r.atribuicao.provedor]} · ${r.atribuicao.modelo}`,
          detalhes: r.falhas.map(textoDaFalha),
        });
        onGerada?.();
      },
      cancelado: () => {
        setEstado({ fase: 'cancelado' });
      },
      erro: (e) => {
        setEstado(estadoDeErro(e));
        onFalhou?.();
      },
    });
  };

  const aoClicarGerar = () => {
    if (!podeGerar) return;
    if (cadeia.length === 0) {
      onConfigurarChaves();
      return;
    }
    setRevisando(true);
  };

  const aoEnviar = () => {
    if (previa === null) return;
    autorizadoRef.current = { usuario: previa.usuario, destinos: cadeia.map(destinoDe) };
    setRevisando(false);
    void gerar();
  };

  /**
   * "Tentar de novo" envia direto só se o pedido é idêntico ao último revisado, a fila não ganhou
   * provedor ou modelo novo e a ata não mudou desde a tentativa (ex.: uma seção editada à mão
   * depois da falha). Qualquer diferença reabre a revisão.
   */
  const aoTentarDeNovo = () => {
    if (!podeGerar) return;
    if (cadeia.length === 0) {
      onConfigurarChaves();
      return;
    }
    const autorizado = autorizadoRef.current;
    const igual =
      autorizado !== null &&
      state.resultado === baseDaTentativaRef.current &&
      cadeia.every((c) => autorizado.destinos.includes(destinoDe(c))) &&
      previaDoEnvio(state, tipo).usuario === autorizado.usuario;
    if (igual) void gerar();
    else setRevisando(true);
  };

  const [primeiro, ...depois] = cadeia;
  const descricaoId = [
    noExemplo ? exemploId : null,
    faltas.length > 0 ? resumoId : null,
    ocupadaPorSecao ? ocupadaId : null,
  ]
    .filter((id) => id !== null)
    .join(' ');

  return (
    <section className={styles.barra} aria-label="Gerar ata">
      <div className={styles.acoes}>
        <Button
          ref={gerarRef}
          variante="primario"
          disabled={!podeGerar}
          aria-describedby={descricaoId === '' ? undefined : descricaoId}
          onClick={aoClicarGerar}
        >
          <span aria-hidden="true">✨</span> Gerar ata
        </Button>
        {gerando ? (
          <Button ref={cancelarRef} onClick={chamada.cancelar}>
            Cancelar
          </Button>
        ) : null}
      </div>

      {noExemplo ? (
        <p id={exemploId} className={styles.statusTexto}>
          {MOTIVO_EXEMPLO}
        </p>
      ) : null}

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

      {/* No exemplo nada é enviado: "Envia para …" contradiria o motivo logo acima. */}
      {noExemplo ? null : (
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
      )}

      {ocupadaPorSecao ? (
        <p id={ocupadaId} className={styles.statusTexto}>
          {MOTIVO_IA_OCUPADA}
        </p>
      ) : null}

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
              aria-describedby={descricaoId === '' ? undefined : descricaoId}
              onClick={aoTentarDeNovo}
            >
              Tentar de novo
            </Button>
            <Button onClick={onConfigurarChaves}>Configurar chaves</Button>
          </div>
        </div>
      ) : null}

      <RevisaoDoEnvio
        aberto={revisando}
        previa={previa}
        cadeia={cadeia}
        substitui={state.resultado !== null}
        onCancelar={() => {
          setRevisando(false);
        }}
        onEnviar={aoEnviar}
      />
    </section>
  );
}
