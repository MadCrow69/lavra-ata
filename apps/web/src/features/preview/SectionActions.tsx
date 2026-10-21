import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import { ErroProvedor } from '../../ai/errors';
import { useKeys } from '../../ai/KeysContext';
import { LIMITE_INSTRUCAO } from '../../config/limits';
import { ROTULO_CURTO } from '../../config/models';
import { useDraft } from '../../domain/DraftContext';
import type { Bloco, Encaminhamento } from '../../domain/draft';
import { CHAVE_ENCAMINHAMENTOS } from '../../domain/draft-reducer';
import { descreverErroDeGeracao, type ErroDeGeracao } from '../../generation/erro-geracao';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { regerarSecao } from '../../generation/pipeline';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import styles from './revisao.module.css';

export const MOTIVO_SEM_CHAVE = 'Configure uma chave de IA para usar esta ação.';

const PLACEHOLDER_INSTRUCAO = 'Ex.: Deixe mais curto · Destaque os prazos';
const FORMATO_NUMERO = new Intl.NumberFormat('pt-BR');

type Origem = 'regerar' | 'ajustar';

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
 * ficam parados com o motivo à vista. O rascunho só muda no sucesso; falha ou cancelamento deixam
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
  const { operacao, iniciar, concluir, cancelar } = useOperacaoIA();

  const [confirmando, setConfirmando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [instrucao, setInstrucao] = useState('');
  const [erro, setErro] = useState<ErroDeGeracao | null>(null);
  const [cancelada, setCancelada] = useState(false);

  const regerarRef = useRef<HTMLButtonElement>(null);
  const ajustarRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const instrucaoRef = useRef<HTMLTextAreaElement>(null);
  const controleRef = useRef<AbortController | null>(null);
  /** Controle que a pessoa cancelou aqui; abortado sem isso = interrompido por fora ("Nova ata"). */
  const canceladoAquiRef = useRef<AbortController | null>(null);
  const origemRef = useRef<Origem>('regerar');
  const ultimaInstrucaoRef = useRef<string | null>(null);
  const baseId = useId();
  const motivoId = `${baseId}-motivo`;
  const instrucaoId = `${baseId}-instrucao`;

  const tipo = obterTipo(state.tipoId);
  const cadeia = keys.cadeia();
  const estaOcupada = operacao?.tipo === 'secao' && operacao.chave === chave;
  const semChave = cadeia.length === 0;
  const motivo = semChave
    ? MOTIVO_SEM_CHAVE
    : operacao !== null && !estaOcupada
      ? MOTIVO_IA_OCUPADA
      : null;
  const iaParada = semChave || operacao !== null || editando;
  const ajusteAberto = ajustando && !vazia;
  // Editar à mão fica livre, salvo quando um resultado de IA vai substituir o que a pessoa fizer.
  const edicaoParada = editando || operacao?.tipo === 'ata' || estaOcupada;

  // Sair da tela no meio da chamada a cancela (não sobra resultado tardio sobre uma folha que sumiu).
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
    if (estaOcupada) {
      cancelarRef.current?.focus();
    } else if (estavaOcupadaRef.current) {
      const ativo = document.activeElement;
      if (ativo === null || ativo === document.body) {
        (origemRef.current === 'ajustar' ? ajustarRef : regerarRef).current?.focus();
      }
    }
    estavaOcupadaRef.current = estaOcupada;
  }, [estaOcupada]);

  // Ao abrir o painel de ajuste, o foco vai para o campo da instrução.
  useEffect(() => {
    if (ajustando) instrucaoRef.current?.focus();
  }, [ajustando]);

  /** Porta única das chamadas (Regerar, Ajustar e "Tentar de novo"). */
  const executar = async (pedido: string | null, origem: Origem) => {
    if (semChave || operacao !== null) return;
    const controle = iniciar({ tipo: 'secao', chave });
    if (controle === null) return;
    controleRef.current = controle;
    origemRef.current = origem;
    ultimaInstrucaoRef.current = pedido;
    setErro(null);
    setCancelada(false);
    try {
      const r = await regerarSecao(
        state,
        tipo,
        chave,
        pedido,
        cadeia,
        controle.signal,
        opcoesCadeia,
      );
      // Cancelada ou interrompida ("Nova ata") enquanto esperava: o resultado tardio é descartado.
      if (controleRef.current !== controle || controle.signal.aborted) return;
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
        detalhes: r.atribuicao.fallbackDe.map((p) => `${ROTULO_CURTO[p]} falhou antes.`),
      });
    } catch (e) {
      if (controleRef.current !== controle) return;
      // Interrompida por fora: a ata em que ela valia já não existe; nada a avisar aqui.
      if (controle.signal.aborted && canceladoAquiRef.current !== controle) return;
      if (e instanceof ErroProvedor && e.tipo === 'cancelado') setCancelada(true);
      else setErro(descreverErroDeGeracao(e, 'seção'));
    } finally {
      if (controleRef.current === controle) controleRef.current = null;
      concluir(controle);
    }
  };

  const aoClicarRegerar = () => {
    if (iaParada) return;
    // Seção vazia não tem edições para perder.
    if (editada && !vazia) setConfirmando(true);
    else void executar(null, 'regerar');
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
                void executar(instrucaoLimpa, 'ajustar');
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
              onClick={() => {
                if (!controleRef.current) return;
                canceladoAquiRef.current = controleRef.current;
                cancelar(controleRef.current);
              }}
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
              onClick={() => {
                void executar(ultimaInstrucaoRef.current, origemRef.current);
              }}
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
                void executar(null, 'regerar');
              }}
            >
              Regerar e substituir
            </Button>
          </>
        }
      >
        <p>Você editou esta seção. Regerar vai substituir suas edições.</p>
      </Modal>
    </div>
  );
}
