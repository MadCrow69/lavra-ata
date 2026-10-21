import { useEffect, useRef, useState } from 'react';
import { obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import { ESPERA_SALVAR_RASCUNHO_MS } from '../../config/ui';
import { DraftProvider, useDraft } from '../../domain/DraftContext';
import type { AtaDraft } from '../../domain/draft';
import { carregarRascunho, salvarRascunho } from '../../domain/persistence';
import { OperacaoIAProvider, useOperacaoIA } from '../../generation/OperacaoIA';
import { AppShell } from '../../shell/AppShell';
import type { AbaId } from '../../shell/MobileTabs';
import { useLarguraLarga } from '../../shell/useLarguraLarga';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { DadosBlock } from '../form/DadosBlock';
import { GenerateBar } from '../form/GenerateBar';
import { ParticipantesBlock } from '../form/ParticipantesBlock';
import { TipoBlock } from '../form/TipoBlock';
import { TranscricaoBlock } from '../form/TranscricaoBlock';
import { KeysModal } from '../keys/KeysModal';
import { A4Preview } from '../preview/A4Preview';
import styles from './workbench.module.css';

const MENSAGEM_NOVA_ATA = 'Nova ata iniciada. Tipo e tom mantidos.';

/** O rascunho tem algo que a pessoa escreveu (um rascunho só com tipo e tom não é "recuperado"). */
function temConteudo(d: AtaDraft): boolean {
  return (
    Object.values(d.dados).some((v) => v.trim() !== '') ||
    d.pauta.length > 0 ||
    d.participantes.length > 0 ||
    d.transcricao.trim() !== '' ||
    d.resultado !== null
  );
}

/** Quantos avisos a ata gerada tem (gerais e por seção): a aba Documento os conta no celular. */
function contarAvisos(d: AtaDraft): number {
  return Object.values(d.resultado?.avisos ?? {}).reduce((total, lista) => total + lista.length, 0);
}

/**
 * Grava o rascunho na sessão `ESPERA_SALVAR_RASCUNHO_MS` depois da última alteração. Esconder a aba
 * (trocar de app no celular, que pode descartá-la sem `pagehide`) ou sair dela (recarregar, fechar)
 * antes disso grava na hora, para a última tecla não se perder.
 */
function useSalvarRascunho(state: AtaDraft): void {
  const atualRef = useRef(state);

  useEffect(() => {
    atualRef.current = state;
    const timer = setTimeout(() => {
      salvarRascunho(state);
    }, ESPERA_SALVAR_RASCUNHO_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [state]);

  useEffect(() => {
    const salvarJa = () => {
      salvarRascunho(atualRef.current);
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') salvarJa();
    };
    window.addEventListener('pagehide', salvarJa);
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      window.removeEventListener('pagehide', salvarJa);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, []);
}

interface BancadaProps {
  recuperou: boolean;
  opcoesCadeia: OpcoesCadeia | undefined;
}

function Bancada({ recuperou, opcoesCadeia }: BancadaProps) {
  const { state, dispatch } = useDraft();
  const { operacao, interromper } = useOperacaoIA();
  const { mostrar } = useToast();
  const largo = useLarguraLarga();
  const [aba, setAba] = useState<AbaId>('editar');
  const [chavesAbertas, setChavesAbertas] = useState(false);
  const [avisoRecuperado, setAvisoRecuperado] = useState(recuperou);
  const [confirmando, setConfirmando] = useState(false);
  /** Cresce a cada "Nova ata": remonta formulário e folha, zerando o estado local de cada um. */
  const [rodada, setRodada] = useState(0);
  const [geracoes, setGeracoes] = useState(0);
  const documentoRef = useRef<HTMLDivElement>(null);
  const novaAtaRef = useRef<HTMLButtonElement>(null);

  useSalvarRascunho(state);

  const tipo = obterTipo(state.tipoId);
  const avisos = contarAvisos(state);
  const opcoes = opcoesCadeia ? { opcoesCadeia } : {};

  // Depois de gerar, a folha rola até o topo; no celular a aba já virou "Documento" e o foco vai
  // para a folha (o botão Gerar ficou na aba oculta).
  const levarAFolhaRef = useRef(false);
  useEffect(() => {
    if (!levarAFolhaRef.current) return;
    levarAFolhaRef.current = false;
    const documento = documentoRef.current;
    if (!documento) return;
    documento.scrollIntoView({ block: 'start' });
    if (!largo) documento.focus({ preventScroll: true });
  }, [geracoes, largo]);

  // Depois de "Nova ata", o foco que se perdeu (ex.: o aviso de rascunho saiu de cena) vai ao
  // botão "Nova ata".
  useEffect(() => {
    if (rodada === 0) return;
    const ativo = document.activeElement;
    if (ativo === null || ativo === document.body) novaAtaRef.current?.focus();
  }, [rodada]);

  const abrirChaves = () => {
    setChavesAbertas(true);
  };

  const novaAta = () => {
    // Primeiro a IA: o resultado de uma chamada antiga nunca pode cair na ata nova.
    interromper();
    dispatch({ type: 'novaAta' });
    setRodada((r) => r + 1);
    setAvisoRecuperado(false);
    setConfirmando(false);
    setAba('editar');
    mostrar({ titulo: MENSAGEM_NOVA_ATA });
  };

  // Rascunho vazio e IA parada: não há o que perder, então "Nova ata" não pergunta.
  const pedirNovaAta = () => {
    if (!temConteudo(state) && operacao === null) novaAta();
    else setConfirmando(true);
  };

  const editar = (
    <div className={styles.coluna}>
      <div className={styles.topo}>
        {avisoRecuperado ? (
          <div className={styles.recuperado}>
            <p className={styles.recuperadoTexto}>Rascunho recuperado desta aba.</p>
            <div className={styles.recuperadoAcoes}>
              <Button
                onClick={() => {
                  setConfirmando(true);
                }}
              >
                Começar do zero
              </Button>
              <button
                type="button"
                className={styles.fechar}
                aria-label="Fechar aviso de rascunho recuperado"
                onClick={() => {
                  setAvisoRecuperado(false);
                }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
        ) : null}
        <Button ref={novaAtaRef} onClick={pedirNovaAta}>
          Nova ata
        </Button>
      </div>
      <div key={rodada} className={styles.coluna}>
        <TipoBlock />
        <DadosBlock tipo={tipo} />
        <ParticipantesBlock tipo={tipo} />
        <TranscricaoBlock tipo={tipo} />
        <GenerateBar
          onConfigurarChaves={abrirChaves}
          onGerada={() => {
            levarAFolhaRef.current = true;
            setAba('documento');
            setGeracoes((g) => g + 1);
          }}
          {...opcoes}
        />
      </div>
    </div>
  );

  const documento = (
    <div ref={documentoRef} className={styles.documento} tabIndex={-1}>
      <A4Preview key={rodada} {...opcoes} />
    </div>
  );

  return (
    <>
      <AppShell
        editar={editar}
        documento={documento}
        onConfigurarChaves={abrirChaves}
        aba={aba}
        onTrocarAba={setAba}
        avisos={{ documento: avisos }}
      />
      <KeysModal
        aberto={chavesAbertas}
        onFechar={() => {
          setChavesAbertas(false);
        }}
        {...(opcoesCadeia?.adaptadores ? { adaptadores: opcoesCadeia.adaptadores } : {})}
      />
      <Modal
        aberto={confirmando}
        titulo="Começar uma nova ata?"
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
            <Button variante="perigo" onClick={novaAta}>
              Apagar e começar
            </Button>
          </>
        }
      >
        <p>
          Os dados da reunião, os participantes, a transcrição e a ata gerada nesta aba serão
          apagados. O tipo de ata e o tom da redação são mantidos.
        </p>
        {operacao !== null ? <p>A geração em andamento será cancelada.</p> : null}
      </Modal>
    </>
  );
}

export interface WorkbenchProps {
  /** Substitui os adaptadores reais e a espera do retry (testes). */
  opcoesCadeia?: OpcoesCadeia;
}

/**
 * A bancada inteira: formulário (blocos 1–4 e barra de geração) em "Editar", a folha em
 * "Documento", o modal de chaves e "Nova ata". O rascunho vem da sessão na abertura (com aviso) e
 * volta para ela a cada alteração, com espera.
 */
export function Workbench({ opcoesCadeia }: WorkbenchProps) {
  // Lido uma vez, na abertura: o que esta aba guardou antes de recarregar.
  const [recuperado] = useState(() => carregarRascunho());
  return (
    <DraftProvider {...(recuperado ? { inicial: recuperado } : {})}>
      <OperacaoIAProvider>
        <Bancada
          recuperou={recuperado !== null && temConteudo(recuperado)}
          opcoesCadeia={opcoesCadeia}
        />
      </OperacaoIAProvider>
    </DraftProvider>
  );
}
