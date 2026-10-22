import { useEffect, useRef, useState } from 'react';
import { obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import { ESPERA_SALVAR_RASCUNHO_MS } from '../../config/ui';
import { DraftProvider, useDraft } from '../../domain/DraftContext';
import type { AtaDraft } from '../../domain/draft';
import { criarRascunho, temConteudo } from '../../domain/draft-reducer';
import { carregarRascunho, salvarRascunho } from '../../domain/persistence';
import { CARREGADORES_EXEMPLO, type CarregadoresExemplo } from '../../exemplos/carregar';
import { gravarExemploNaSessao, lerExemploDaSessao } from '../../exemplos/sessao';
import { OperacaoIAProvider, useOperacaoIA } from '../../generation/OperacaoIA';
import { LogoProvider, useLogo } from '../../logo/LogoContext';
import type { LogoStore } from '../../logo/logo-store';
import { prepararLogo } from '../../logo/rasterizar-logo';
import { usePreferenciasStore } from '../../preferencias/PreferenciasContext';
import type { LogoDoc } from '../../document/model';
import { AppShell } from '../../shell/AppShell';
import type { AbaId } from '../../shell/MobileTabs';
import { useLarguraLarga } from '../../shell/useLarguraLarga';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { ModoExemploProvider } from '../exemplo/ModoExemplo';
import { useModoExemploDaBancada } from '../exemplo/useModoExemploDaBancada';
import { DadosBlock } from '../form/DadosBlock';
import { GenerateBar } from '../form/GenerateBar';
import { ParticipantesBlock } from '../form/ParticipantesBlock';
import { TipoBlock } from '../form/TipoBlock';
import { TranscricaoBlock } from '../form/TranscricaoBlock';
import { KeysModal } from '../keys/KeysModal';
import { A4Preview } from '../preview/A4Preview';
import { GeracaoNoDocumento } from './GeracaoNoDocumento';
import styles from './workbench.module.css';

const MENSAGEM_NOVA_ATA = 'Nova ata iniciada. Tipo e tom mantidos.';
const MENSAGEM_NOVA_ATA_COM_LOGO = 'Nova ata iniciada. Tipo, tom e logo mantidos.';
/** No exemplo o tom é sempre formal: "Nova ata" devolve o tom da pessoa, e diz isso. */
const MENSAGEM_NOVA_ATA_NO_EXEMPLO =
  'Nova ata iniciada. Tipo mantido; o tom voltou ao que você usava.';
const MENSAGEM_NOVA_ATA_NO_EXEMPLO_COM_LOGO =
  'Nova ata iniciada. Tipo e logo mantidos; o tom voltou ao que você usava.';

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
      // Desmontar (inclusive pelo limite de erro) com o timer pendente não pode perder a última tecla.
      salvarJa();
      window.removeEventListener('pagehide', salvarJa);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, []);
}

interface BancadaProps {
  recuperou: boolean;
  /** Tipo do exemplo que esta aba mostrava antes de recarregar (o rascunho de partida é ele). */
  exemploRecuperado: string | null;
  opcoesCadeia: OpcoesCadeia | undefined;
  exemplos: CarregadoresExemplo;
  /** Rasteriza a logo fictícia do exemplo (a mesma porta da logo da pessoa). */
  processarLogo: (arquivo: File) => Promise<LogoDoc>;
}

function Bancada({
  recuperou,
  exemploRecuperado,
  opcoesCadeia,
  exemplos,
  processarLogo,
}: BancadaProps) {
  const { state } = useDraft();
  const { operacao } = useOperacaoIA();
  const { mostrar } = useToast();
  const { logo } = useLogo();
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

  const exemplo = useModoExemploDaBancada({
    exemploRecuperado,
    exemplos,
    processarLogo,
    // Exemplo carregado ou deixado: formulário e folha remontam e os avisos da bancada fecham.
    recomecar: (destino) => {
      setRodada((r) => r + 1);
      setAvisoRecuperado(false);
      setConfirmando(false);
      setAba(destino);
    },
  });

  const novaAta = () => {
    const noExemplo = exemplo.ligado;
    exemplo.reiniciar();
    const titulo = noExemplo
      ? logo === null
        ? MENSAGEM_NOVA_ATA_NO_EXEMPLO
        : MENSAGEM_NOVA_ATA_NO_EXEMPLO_COM_LOGO
      : logo === null
        ? MENSAGEM_NOVA_ATA
        : MENSAGEM_NOVA_ATA_COM_LOGO;
    mostrar({ titulo });
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
          onFalhou={() => {
            // No celular, quem esperava na aba Documento vê o erro (e "Tentar de novo") no Editar.
            setAba('editar');
          }}
          {...opcoes}
        />
      </div>
    </div>
  );

  const documento = (
    <div ref={documentoRef} className={styles.documento} tabIndex={-1}>
      {largo ? null : <GeracaoNoDocumento key={`geracao-${String(rodada)}`} />}
      <A4Preview key={rodada} {...opcoes} />
    </div>
  );

  return (
    <ModoExemploProvider valor={exemplo.valor}>
      <AppShell
        editar={editar}
        documento={documento}
        onConfigurarChaves={abrirChaves}
        onVerExemplo={exemplo.abrirSeletor}
        aviso={exemplo.aviso}
        aba={aba}
        onTrocarAba={setAba}
        avisos={{ documento: avisos }}
      />
      {exemplo.modais}
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
        {exemplo.ligado ? (
          <p>
            O exemplo desta aba (dados, participantes, transcrição e ata gerada) será apagado. O
            tipo de ata é mantido e o tom da redação volta ao que você usava.
            {logo === null ? '' : ' A sua logo é mantida.'}
          </p>
        ) : (
          <p>
            Os dados da reunião, os participantes, a transcrição e a ata gerada nesta aba serão
            apagados.{' '}
            {logo === null
              ? 'O tipo de ata e o tom da redação são mantidos.'
              : 'O tipo de ata, o tom da redação e a logo são mantidos.'}
          </p>
        )}
        {operacao !== null ? <p>A geração em andamento será cancelada.</p> : null}
      </Modal>
    </ModoExemploProvider>
  );
}

export interface WorkbenchProps {
  /** Substitui os adaptadores reais e a espera do retry (testes). */
  opcoesCadeia?: OpcoesCadeia;
  /** Armazenamento e processamento da logo (testes); o padrão é o do navegador. */
  logo?: { store?: LogoStore; processar?: (arquivo: File) => Promise<LogoDoc> };
  /** Carregadores dos exemplos (testes); o padrão são os chunks `exemplo-*` do próprio site. */
  exemplos?: CarregadoresExemplo;
}

/**
 * A bancada inteira: formulário (blocos 1–4 e barra de geração) em "Editar", a folha em
 * "Documento", o modal de chaves, "Nova ata" e o modo exemplo ("Ver exemplo" no cabeçalho, banner
 * com "Começar a minha", IA parada). O rascunho vem da sessão na abertura (com aviso, salvo no modo
 * exemplo, que volta com a marca `EXEMPLO`) e volta para ela a cada alteração, com espera. A logo
 * tem armazenamento próprio (`LogoProvider`): nunca entra no rascunho e sobrevive a "Nova ata"; a
 * do exemplo vive só na memória e nunca a substitui.
 */
export function Workbench({ opcoesCadeia, logo, exemplos = CARREGADORES_EXEMPLO }: WorkbenchProps) {
  // Lido uma vez, na abertura: o que esta aba guardou antes de recarregar.
  const [recuperado] = useState(() => carregarRascunho());
  // A marca do modo exemplo só vale com o rascunho do mesmo tipo (o tipo não muda no exemplo).
  const [exemploRecuperado] = useState(() => {
    const marca = lerExemploDaSessao();
    return marca !== null && marca === recuperado?.tipoId ? marca : null;
  });
  useEffect(() => {
    // Marca sem o rascunho correspondente não serve para nada: sai da sessão.
    if (exemploRecuperado === null) gravarExemploNaSessao(null);
  }, [exemploRecuperado]);
  // Sem rascunho na sessão, a ata nova parte do tipo e do tom lembrados (se houver).
  const preferencias = usePreferenciasStore();
  const [inicial] = useState(
    () =>
      recuperado ??
      criarRascunho(obterTipo(preferencias.atual().tipoId ?? '').id, preferencias.atual().tom),
  );
  return (
    <LogoProvider
      {...(logo?.store ? { store: logo.store } : {})}
      {...(logo?.processar ? { processar: logo.processar } : {})}
    >
      <DraftProvider inicial={inicial}>
        <OperacaoIAProvider>
          <Bancada
            recuperou={recuperado !== null && temConteudo(recuperado) && exemploRecuperado === null}
            exemploRecuperado={exemploRecuperado}
            opcoesCadeia={opcoesCadeia}
            exemplos={exemplos}
            processarLogo={logo?.processar ?? prepararLogo}
          />
        </OperacaoIAProvider>
      </DraftProvider>
    </LogoProvider>
  );
}
