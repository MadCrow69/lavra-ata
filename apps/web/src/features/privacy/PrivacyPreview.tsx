import { findMarkers } from '@lavra/pii-br';
import { Fragment, useMemo, useState } from 'react';
import { useDraft } from '../../domain/DraftContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { fatiar, type Parte } from './fatiar';
import styles from './privacy.module.css';
import { fraseDoSelo } from './rotulos';
import { usePrivacyScan, type PrivacyScan } from './usePrivacyScan';

function Texto({ partes, classeMarca }: { partes: Parte[]; classeMarca: string }) {
  return partes.map((p) =>
    p.destaque ? (
      <mark key={p.inicio} className={classeMarca}>
        {p.texto}
      </mark>
    ) : (
      <Fragment key={p.inicio}>{p.texto}</Fragment>
    ),
  );
}

function Comparativo({ texto, scan }: { texto: string; scan: PrivacyScan }) {
  const original = useMemo(() => fatiar(texto, scan.achados), [texto, scan.achados]);
  const enviado = useMemo(
    () => fatiar(scan.mascarado, findMarkers(scan.mascarado)),
    [scan.mascarado],
  );

  return (
    <div className={styles.comparativo}>
      <p className={styles.aviso}>
        <strong>Nomes de pessoas não são removidos — a ata precisa deles.</strong> Só documentos,
        contatos e cartões viram marcadores. A IA recebe apenas a coluna “Enviado à IA”; ao final,
        os marcadores voltam para os valores originais neste navegador.
      </p>
      {scan.colisoes.length > 0 ? (
        <p className={styles.aviso}>
          {`Atenção: ${scan.colisoes.join(', ')} já aparece${scan.colisoes.length === 1 ? '' : 'm'} no texto como se fosse um marcador e foi reescrito para não se confundir com os de verdade.`}
        </p>
      ) : null}
      <div className={styles.colunas}>
        <section className={styles.coluna}>
          <h3 className={styles.colunaTitulo}>Original</h3>
          <div
            className={styles.texto}
            role="region"
            aria-label="Original"
            tabIndex={0}
            data-testid="coluna-original"
          >
            <Texto partes={original} classeMarca={styles.marcaOriginal ?? ''} />
          </div>
        </section>
        <section className={styles.coluna}>
          <h3 className={styles.colunaTitulo}>Enviado à IA</h3>
          <div
            className={styles.texto}
            role="region"
            aria-label="Enviado à IA"
            tabIndex={0}
            data-testid="coluna-enviado"
          >
            <Texto partes={enviado} classeMarca={styles.marca ?? ''} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Selo com a contagem de dados pessoais e o botão que abre o comparativo "Original × Enviado à IA". */
export function PrivacyPreview({ texto }: { texto: string }) {
  const { state } = useDraft();
  const scan = usePrivacyScan(texto, state.mapa);
  const [aberto, setAberto] = useState(false);

  return (
    <div className={styles.previa}>
      <p className={styles.selo} aria-live="polite" data-pendente={scan.pendente}>
        {texto === '' ? (
          'Cole a transcrição para ver quais dados pessoais serão protegidos.'
        ) : scan.pendente ? (
          'Verificando dados pessoais…'
        ) : (
          <>
            <span aria-hidden="true">🛡 </span>
            {fraseDoSelo(scan.total, scan.contagem)}
          </>
        )}
      </p>
      <Button
        disabled={texto === '' || scan.pendente}
        onClick={() => {
          setAberto(true);
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
        <Comparativo texto={texto} scan={scan} />
      </Modal>
    </div>
  );
}
