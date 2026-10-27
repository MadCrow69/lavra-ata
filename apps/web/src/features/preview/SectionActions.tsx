import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import { useKeys } from '../../ai/KeysContext';
import { LIMITE_INSTRUCAO } from '../../config/limits';
import { ROTULO_CURTO } from '../../config/models';
import { useDraft } from '../../domain/DraftContext';
import type { Bloco, Encaminhamento } from '../../domain/draft';
import { CHAVE_ENCAMINHAMENTOS } from '../../domain/draft-reducer';
import { textoDaFalha } from '../../generation/atribuicao';
import { descreverErroDeGeracao, type ErroDeGeracao } from '../../generation/erro-geracao';
import {
  destinoDe,
  motivoParaRevisar,
  TEXTO_MOTIVO_REVISAO,
  type MotivoDaRevisao,
} from '../../generation/autorizacao';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { prepararEnvioDaSecao, previaDoEnvioSecao, regerarSecao } from '../../generation/pipeline';
import { useChamadaIA } from '../../generation/useChamadaIA';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { MOTIVO_EXEMPLO, useModoExemplo } from '../exemplo/ModoExemplo';
import { ROTULO_ENVIAR } from '../privacy/revisao-textos';
import { prepararRevisao, RevisaoDoEnvioSobDemanda } from '../privacy/RevisaoSobDemanda';
import styles from './revisao.module.css';

export const MOTIVO_SEM_CHAVE = 'Configure uma chave de IA para usar esta ação.';

const PLACEHOLDER_INSTRUCAO = 'Ex.: Deixe mais curto · Destaque os prazos';
const FORMATO_NUMERO = new Intl.NumberFormat('pt-BR');

type Origem = 'regerar' | 'ajustar';

/** Revisão de um pedido de seção aberta: o que seria enviado e por que a revisão abriu. */
interface RevisaoDaSecao {
  pedido: string | null;
  origem: Origem;
  motivo: MotivoDaRevisao;
}

function ehEncaminhamento(item: Bloco | Encaminhamento): item is Encaminhamento {
  return 'acao' in item;
}

function ehBloco(item: Bloco | Encaminhamento): item is Bloco {
  return 'itens' in item;
}

export interface SectionActionsProps {
  /** Chave da seção (`'encaminhamentos'` incluso). */
  chave: string;
  titulo: string;
  /** "Gerado por …" ou "Editado por você"; `null` quando não há o que dizer. */
  atribuicao: string | null;
  /** A seção foi alterada à mão: regerar pede confirmação. */
  editada: boolean;
  /** Seção sem conteúdo (placeholder da tela): Escrever / Gerar esta seção, sem Ajustar. */
  vazia?: boolean;
  /** O editor da seção está aberto (as ações ficam paradas até fechar). */
  editando: boolean;
  onEditar: () => void;
  editarRef: Ref<HTMLButtonElement>;
  /** Substitui os adaptadores reais e a espera do retry (testes). */
  opcoesCadeia?: OpcoesCadeia;
}

/**
 * Rodapé de uma seção gerada: atribuição, Editar / Regerar / Ajustar com instrução, progresso
 * com Cancelar, erro com "Tentar de novo" e a confirmação de regerar uma seção editada à mão.
 *
 * Só uma operação de IA roda por vez no app (`useOperacaoIA`): enquanto há outra, os botões de IA
 * ficam parados com o motivo à vista.
 *
 * Revisão: o pedido de uma seção leva o conteúdo-base (dados, pauta, participantes e transcrição
 * mascarados) mais o texto atual da seção e a instrução. Se o conteúdo-base é o mesmo da última
 * revisão autorizada (na barra ou numa seção) e a fila não ganhou provedor nem modelo, sai direto: o
 * texto da seção e a instrução estão à vista da pessoa. Senão (nada autorizado nesta sessão,
 * transcrição ou dados editados depois, autorização revogada por "Cancelar"), abre "Revise o que
 * vai para a IA" com o pedido exato da seção. O rascunho só muda no sucesso; falha ou cancelamento deixam
 * a seção como estava.
 */
export function SectionActions({
  chave,
  titulo,
  atribuicao,
  editada,
  vazia = false,
  editando,
  onEditar,
  editarRef,
  opcoesCadeia,
}: SectionActionsProps) {
  const { state, dispatch } = useDraft();
  const keys = useKeys();
  const { mostrar } = useToast();

  const [confirmando, setConfirmando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [instrucao, setInstrucao] = useState('');
  const [erro, setErro] = useState<ErroDeGeracao | null>(null);
  const [cancelada, setCancelada] = useState(false);
  const [revisao, setRevisao] = useState<RevisaoDaSecao | null>(null);
  const { autorizado, autorizar, revogar } = useOperacaoIA();

  const regerarRef = useRef<HTMLButtonElement>(null);
  const ajustarRef = useRef<HTMLButtonElement>(null);
  const instrucaoRef = useRef<HTMLTextAreaElement>(null);
  const origemRef = useRef<Origem>('regerar');
  // O botão que iniciou a chamada fica parado: o foco vai para Cancelar e volta a ele no fim.
  const chamada = useChamadaIA(
    { tipo: 'secao', chave },
    () => (origemRef.current === 'ajustar' ? ajustarRef : regerarRef).current,
    opcoesCadeia,
  );
  const { operacao, ocupada: estaOcupada, cancelarRef } = chamada;
  const ultimaInstrucaoRef = useRef<string | null>(null);
  /** Conteúdo da seção quando a última tentativa saiu (para saber se mudou desde então). */
  const baseDaTentativaRef = useRef<unknown>(null);
  const baseId = useId();
  const motivoId = `${baseId}-motivo`;
  const instrucaoId = `${baseId}-instrucao`;

  const tipo = obterTipo(state.tipoId);
  const conteudo =
    chave === CHAVE_ENCAMINHAMENTOS
      ? state.resultado?.encaminhamentos
      : state.resultado?.secoes[chave];
  const cadeia = keys.cadeia();
  const semChave = cadeia.length === 0;
  // No modo exemplo nada vai para a IA: a seção se edita à mão, mas não se regera nem se ajusta.
  const noExemplo = useModoExemplo().tipoId !== null;
  const motivo = noExemplo
    ? MOTIVO_EXEMPLO
    : semChave
      ? MOTIVO_SEM_CHAVE
      : operacao !== null && !estaOcupada
        ? MOTIVO_IA_OCUPADA
        : null;
  const iaParada = noExemplo || semChave || operacao !== null || editando;
  const ajusteAberto = ajustando && !vazia;
  // Editar à mão fica livre, salvo quando um resultado de IA vai substituir o que a pessoa fizer.
  const edicaoParada = editando || operacao?.tipo === 'ata' || estaOcupada;

  // Ao abrir o painel de ajuste, o foco vai para o campo da instrução.
  useEffect(() => {
    if (ajustando) instrucaoRef.current?.focus();
  }, [ajustando]);

  // Montado do MESMO rascunho que `enviar` usa neste render: o revisado é o enviado.
  const previa = useMemo(
    () =>
      revisao === null
        ? null
        : previaDoEnvioSecao(state, obterTipo(state.tipoId), chave, revisao.pedido),
    [revisao, state, chave],
  );

  /** A chamada em si; só `pedirEnvio` (ou o "Enviar" da revisão) chega aqui. */
  const enviar = async (pedido: string | null, origem: Origem) => {
    if (noExemplo || semChave || operacao !== null) return;
    await chamada.executar(
      (signal, opcoes) => regerarSecao(state, tipo, chave, pedido, cadeia, signal, opcoes),
      {
        aoIniciar: () => {
          baseDaTentativaRef.current = conteudo;
          origemRef.current = origem;
          ultimaInstrucaoRef.current = pedido;
          setErro(null);
          setCancelada(false);
        },
        sucesso: (r) => {
          const itens: (Bloco | Encaminhamento)[] = r.blocos;
          const ehEnc = chave === CHAVE_ENCAMINHAMENTOS;
          const encaminhamentos = itens.filter(ehEncaminhamento);
          const blocos = itens.filter(ehBloco);
          if ((ehEnc ? encaminhamentos : blocos).length === 0) {
            setErro({
              titulo: 'A IA devolveu a seção vazia.',
              detalhes: ['Tente de novo, ou ajuste com uma instrução mais específica.'],
            });
            return;
          }
          if (ehEnc) {
            dispatch({
              type: 'substituirEncaminhamentos',
              itens: encaminhamentos,
              avisos: r.avisos,
              atribuicao: r.atribuicao,
              mapa: r.mapa,
            });
          } else {
            dispatch({
              type: 'substituirSecao',
              chave,
              blocos,
              avisos: r.avisos,
              atribuicao: r.atribuicao,
              mapa: r.mapa,
            });
          }
          setAjustando(false);
          setInstrucao('');
          mostrar({
            titulo: `Seção “${titulo}” regerada por ${ROTULO_CURTO[r.atribuicao.provedor]} · ${r.atribuicao.modelo}`,
            detalhes: r.atribuicao.falhas.map(textoDaFalha),
          });
        },
        cancelado: () => {
          setCancelada(true);
        },
        erro: (e) => {
          setErro(descreverErroDeGeracao(e, 'seção'));
        },
      },
    );
  };

  /**
   * Porta única das chamadas (Regerar, Ajustar e "Tentar de novo"): envia direto se o conteúdo-base
   * já foi autorizado; senão abre a revisão.
   */
  const pedirEnvio = (pedido: string | null, origem: Origem) => {
    if (noExemplo || semChave || operacao !== null) return;
    const { base } = prepararEnvioDaSecao(state, tipo, chave, pedido);
    const motivo = motivoParaRevisar(autorizado(), base, cadeia);
    if (motivo === null) void enviar(pedido, origem);
    else setRevisao({ pedido, origem, motivo });
  };

  const aoEnviarRevisao = () => {
    if (revisao === null || previa === null) return;
    autorizar({ base: previa.base, destinos: cadeia.map(destinoDe) });
    setRevisao(null);
    void enviar(revisao.pedido, revisao.origem);
  };

  /** Cancelar a revisão revoga a autorização: nada sai sem revisar de novo. */
  const aoCancelarRevisao = () => {
    revogar();
    setRevisao(null);
  };

  const aoClicarRegerar = () => {
    if (iaParada) return;
    // Seção vazia não tem edições para perder.
    if (editada && !vazia) setConfirmando(true);
    else pedirEnvio(null, 'regerar');
  };

  /**
   * "Tentar de novo" repete a última ação pela mesma porta: regerar uma seção editada à mão desde
   * a tentativa passa pela confirmação de substituir (ajustar parte do texto atual e não pergunta).
   */
  const aoTentarDeNovo = () => {
    if (iaParada) return;
    if (origemRef.current === 'ajustar') {
      pedirEnvio(ultimaInstrucaoRef.current, 'ajustar');
      return;
    }
    if (editada && !vazia && conteudo !== baseDaTentativaRef.current) setConfirmando(true);
    else pedirEnvio(null, 'regerar');
  };

  const aoTeclarNoAjuste = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    setAjustando(false);
    ajustarRef.current?.focus();
  };

  /** Abrir o editor encerra os avisos de uma tentativa anterior (cancelada ou com erro). */
  const aoClicarEditar = () => {
    setErro(null);
    setCancelada(false);
    onEditar();
  };

  const instrucaoLimpa = instrucao.trim();
  const descricao = motivo === null ? undefined : motivoId;

  return (
    <div className={styles.revisao}>
      <div className={styles.rodape}>
        {atribuicao === null ? <span /> : <p className={styles.atribuicao}>{atribuicao}</p>}
        <div
          className={styles.acoes}
          data-fixa={motivo !== null || estaOcupada || ajusteAberto ? '' : undefined}
        >
          <div className={styles.botoesAcao}>
            <button
              ref={editarRef}
              type="button"
              className={styles.acao}
              disabled={edicaoParada}
              aria-label={`${vazia ? 'Escrever' : 'Editar'} seção ${titulo}`}
              aria-describedby={operacao !== null && !estaOcupada ? motivoId : undefined}
              onClick={aoClicarEditar}
            >
              {vazia ? 'Escrever' : 'Editar'}
            </button>
            <button
              ref={regerarRef}
              type="button"
              className={styles.acao}
              disabled={iaParada}
              aria-label={vazia ? `Gerar esta seção (${titulo})` : `Regerar seção ${titulo}`}
              aria-describedby={descricao}
              onClick={aoClicarRegerar}
              onPointerEnter={prepararRevisao}
              onFocus={prepararRevisao}
            >
              {vazia ? 'Gerar esta seção' : 'Regerar'}
            </button>
            {vazia ? null : (
              <button
                ref={ajustarRef}
                type="button"
                className={styles.acao}
                disabled={iaParada}
                aria-label={`Ajustar seção ${titulo} com instrução`}
                aria-describedby={descricao}
                aria-expanded={ajustando}
                onClick={() => {
                  setAjustando((aberto) => !aberto);
                }}
                onPointerEnter={prepararRevisao}
                onFocus={prepararRevisao}
              >
                Ajustar
              </button>
            )}
          </div>
          {motivo === null ? null : (
            <p id={motivoId} className={styles.motivo}>
              {motivo}
            </p>
          )}
        </div>
      </div>

      {ajusteAberto ? (
        <div
          role="group"
          aria-label={`Ajustar seção ${titulo} com instrução`}
          className={styles.ajuste}
          onKeyDown={aoTeclarNoAjuste}
        >
          <label htmlFor={instrucaoId} className={styles.rotulo}>
            {`Instrução para a seção ${titulo}`}
          </label>
          <textarea
            id={instrucaoId}
            ref={instrucaoRef}
            className={styles.campo}
            rows={3}
            maxLength={LIMITE_INSTRUCAO}
            value={instrucao}
            placeholder={PLACEHOLDER_INSTRUCAO}
            onChange={(e) => {
              setInstrucao(e.target.value);
            }}
          />
          <p className={styles.contador}>
            {`${FORMATO_NUMERO.format(instrucao.length)} / ${FORMATO_NUMERO.format(LIMITE_INSTRUCAO)}`}
          </p>
          <div className={styles.botoes}>
            <Button
              variante="primario"
              disabled={instrucaoLimpa === '' || iaParada}
              aria-describedby={descricao}
              onClick={() => {
                pedirEnvio(instrucaoLimpa, 'ajustar');
              }}
            >
              Aplicar ajuste
            </Button>
            <Button
              onClick={() => {
                setAjustando(false);
                ajustarRef.current?.focus();
              }}
            >
              Fechar
            </Button>
          </div>
        </div>
      ) : null}

      <div className={styles.status} aria-live="polite">
        {estaOcupada ? (
          <>
            <progress className={styles.progresso} aria-label={`Regerando a seção ${titulo}`} />
            <p className={styles.statusTexto}>Regerando a seção — pode levar até 2 minutos.</p>
            <Button
              ref={cancelarRef}
              aria-label={`Cancelar regeração da seção ${titulo}`}
              onClick={chamada.cancelar}
            >
              Cancelar
            </Button>
          </>
        ) : null}
        {cancelada ? (
          <p className={styles.statusTexto}>Regeração cancelada. A seção não foi alterada.</p>
        ) : null}
      </div>

      {erro === null ? null : (
        <div role="alert" className={styles.erro}>
          <p className={styles.erroTitulo}>
            <span aria-hidden="true">⚠ </span>
            {erro.titulo}
          </p>
          {erro.detalhes.length > 0 ? (
            <ul className={styles.erroDetalhes}>
              {erro.detalhes.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          <p className={styles.erroDetalhes}>A seção não foi alterada.</p>
          <div className={styles.botoes}>
            <Button
              variante="primario"
              disabled={iaParada}
              aria-describedby={descricao}
              onClick={aoTentarDeNovo}
              onPointerEnter={prepararRevisao}
              onFocus={prepararRevisao}
            >
              Tentar de novo
            </Button>
            <Button
              onClick={() => {
                setErro(null);
              }}
            >
              Fechar aviso
            </Button>
          </div>
        </div>
      )}

      <Modal
        aberto={confirmando}
        titulo="Regerar esta seção?"
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
                pedirEnvio(null, 'regerar');
              }}
            >
              Regerar e substituir
            </Button>
          </>
        }
      >
        <p>Você editou esta seção. Regerar vai substituir suas edições.</p>
      </Modal>

      <RevisaoDoEnvioSobDemanda
        previa={previa}
        cadeia={cadeia}
        descricao={`Pedido para reescrever a seção “${titulo}” (com o texto atual dela${(revisao?.pedido ?? null) === null ? '' : ' e a sua instrução'}).`}
        motivo={revisao === null ? null : TEXTO_MOTIVO_REVISAO[revisao.motivo]}
        avisoSubstituir="A resposta substitui o texto atual desta seção; as outras seções não mudam."
        rotuloEnviar={ROTULO_ENVIAR}
        onCancelar={aoCancelarRevisao}
        onEnviar={aoEnviarRevisao}
      />
    </div>
  );
}
