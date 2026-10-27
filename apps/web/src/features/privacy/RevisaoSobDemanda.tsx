import type { ProviderConfig } from '../../ai/types';
import type { PreviaDoEnvio } from '../../generation/pipeline';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { preCarregar, sobDemanda, useSobDemanda } from '../../ui/sob-demanda';
import styles from './privacy.module.css';
import { CARREGANDO_REVISAO, TEXTO_FALHA_REVISAO, TITULO_FALHA_REVISAO } from './revisao-textos';

export interface RevisaoDoEnvioProps {
  /** O pedido exato (`previaDoEnvio` / `previaDoEnvioSecao`): o que aparece é o que sai ao enviar. */
  previa: PreviaDoEnvio;
  /** Fila de provedores, na ordem em que serão tentados. */
  cadeia: readonly ProviderConfig[];
  /** O que vai ser pedido, numa frase ("Pedido da ata inteira."). */
  descricao: string;
  /** Por que a revisão reabriu (algo mudou desde a última autorizada); `null` = primeira. */
  motivo: string | null;
  /** Aviso de que o envio substitui o que existe; `null` = nada a substituir. */
  avisoSubstituir: string | null;
  /** Rótulo do botão primário ("Enviar para a IA", "Enviar e substituir a ata"). */
  rotuloEnviar: string;
  onCancelar: () => void;
  onEnviar: () => void;
}

/** O diálogo só é usado depois de um clique: fica fora da carga inicial. */
const REVISAO = sobDemanda(() => import('./RevisaoDoEnvio'));

/** Pré-carga no hover/foco de quem abre a revisão ("Gerar ata", ações de seção). */
export function prepararRevisao(): void {
  preCarregar(REVISAO);
}

/** Montado só com a revisão aberta: carrega o diálogo e mostra o estado da carga. */
function RevisaoCarregada(props: RevisaoDoEnvioProps) {
  const { modulo, falhou, tentarDeNovo } = useSobDemanda(REVISAO);
  if (modulo !== null) return <modulo.RevisaoDoEnvio {...props} />;
  if (falhou) {
    // Falha fechada: sem o diálogo nada sai; a pessoa vê o motivo e pode tentar de novo.
    return (
      <Modal
        aberto
        titulo={TITULO_FALHA_REVISAO}
        onFechar={props.onCancelar}
        acoes={
          <>
            <Button onClick={props.onCancelar}>Fechar</Button>
            <Button variante="primario" onClick={tentarDeNovo}>
              Tentar de novo
            </Button>
          </>
        }
      >
        <p>{TEXTO_FALHA_REVISAO}</p>
      </Modal>
    );
  }
  return (
    <p role="status" className={styles.carregando}>
      {CARREGANDO_REVISAO}
    </p>
  );
}

/**
 * Revisão antes do envio, carregada sob demanda (`RevisaoDoEnvio` e os avisos ficam fora da carga
 * inicial). Fechada (`previa === null`), não renderiza nada.
 */
export function RevisaoDoEnvioSobDemanda(
  props: Omit<RevisaoDoEnvioProps, 'previa'> & { previa: PreviaDoEnvio | null },
) {
  const { previa } = props;
  if (previa === null) return null;
  return <RevisaoCarregada {...props} previa={previa} />;
}
