import { useState } from 'react';
import { useDraft } from '../../domain/DraftContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { preCarregar, sobDemanda, useSobDemanda } from '../../ui/sob-demanda';
import styles from './privacy.module.css';
import { fraseDoSelo } from './rotulos';
import { usePrivacyScan, type PrivacyScan } from './usePrivacyScan';

/** O comparativo só abre em "Ver o que vai para a IA": fica fora da carga inicial. */
const COMPARATIVO = sobDemanda(() => import('./Comparativo'));

/** Corpo do diálogo: o comparativo quando carregou; antes disso, o estado da carga. */
function ComparativoSobDemanda({ scan }: { scan: PrivacyScan }) {
  const { modulo, falhou, tentarDeNovo } = useSobDemanda(COMPARATIVO);
  if (modulo !== null) return <modulo.Comparativo scan={scan} />;
  if (falhou) {
    return (
      <div role="alert">
        <p>Não foi possível carregar a comparação. Verifique a conexão e tente de novo.</p>
        <Button onClick={tentarDeNovo}>Tentar de novo</Button>
      </div>
    );
  }
  return (
    <p role="status" className={styles.carregando}>
      Carregando a comparação…
    </p>
  );
}

/** Selo com a contagem de dados pessoais e o botão que abre o comparativo "Original × Enviado à IA". */
export function PrivacyPreview({ texto }: { texto: string }) {
  const { state } = useDraft();
  const scan = usePrivacyScan(texto, state.mapa);
  const [aberto, setAberto] = useState(false);

  return (
    <div className={styles.previa}>
      {/* Uma região só anuncia as duas linhas (dado pessoal e termo sensível) quando mudam. */}
      <div className={styles.selos} aria-live="polite">
        <p className={styles.selo} data-pendente={scan.pendente}>
          {texto === '' ? (
            'Cole a transcrição para ver quais dados pessoais serão protegidos.'
          ) : scan.excedido ? (
            'Reduza a transcrição ao limite para ver a prévia.'
          ) : scan.pendente ? (
            'Verificando dados pessoais…'
          ) : (
            <>
              <span aria-hidden="true">🛡 </span>
              {fraseDoSelo(scan.total, scan.contagem)}
            </>
          )}
        </p>
        {texto !== '' && !scan.excedido && !scan.pendente && scan.fraseSensiveis !== null ? (
          <p className={styles.seloSensivel}>
            <span aria-hidden="true">⚠ </span>
            {scan.fraseSensiveis}
          </p>
        ) : null}
      </div>
      <Button
        disabled={texto === '' || scan.excedido || scan.pendente}
        onClick={() => {
          setAberto(true);
        }}
        onPointerEnter={() => {
          preCarregar(COMPARATIVO);
        }}
        onFocus={() => {
          preCarregar(COMPARATIVO);
        }}
      >
        Ver o que vai para a IA
      </Button>
      <Modal
        aberto={aberto}
        titulo="O que vai para a IA"
        onFechar={() => {
          setAberto(false);
        }}
      >
        <ComparativoSobDemanda scan={scan} />
      </Modal>
    </div>
  );
}
