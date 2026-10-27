import { findMarkers } from '@lavra/pii-br';
import { useMemo, useState } from 'react';
import { useDraft } from '../../domain/DraftContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { AvisoColisoes, AvisoNomes, fraseDoAvisoSensivel } from './avisos';
import { fatiar, mesclarTrechos } from './fatiar';
import styles from './privacy.module.css';
import { fraseDoSelo } from './rotulos';
import { detectarTermosSensiveis, ehTermoSensivel } from './termos-sensiveis';
import { TextoDestacado } from './TextoDestacado';
import { usePrivacyScan, type PrivacyScan } from './usePrivacyScan';

/** Classe do destaque: o dado pessoal/marcador (`classePii`) ou o termo sensível. */
function classeDoTrecho(classePii: string) {
  return (t: object) => (ehTermoSensivel(t) ? (styles.marcaSensivel ?? '') : classePii);
}

function Comparativo({ scan }: { scan: PrivacyScan }) {
  const original = useMemo(
    () => fatiar(scan.analisado, mesclarTrechos(scan.achados, scan.sensiveis)),
    [scan.analisado, scan.achados, scan.sensiveis],
  );
  const enviado = useMemo(
    () =>
      fatiar(
        scan.mascarado,
        mesclarTrechos(findMarkers(scan.mascarado), detectarTermosSensiveis(scan.mascarado)),
      ),
    [scan.mascarado],
  );

  return (
    <div className={styles.comparativo}>
      <AvisoNomes>
        A IA recebe apenas a coluna “Enviado à IA”; ao final, os marcadores voltam para os valores
        originais neste navegador.
      </AvisoNomes>
      {scan.sensiveis.length > 0 ? (
        <p className={styles.aviso}>
          Trechos com contorno tracejado são possível dado sensível: não viram marcador e vão como
          estão.
        </p>
      ) : null}
      <AvisoColisoes colisoes={scan.colisoes} />
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
            <TextoDestacado
              partes={original}
              classeDe={classeDoTrecho(styles.marcaOriginal ?? '')}
            />
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
            <TextoDestacado partes={enviado} classeDe={classeDoTrecho(styles.marca ?? '')} />
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
        {texto !== '' && !scan.excedido && !scan.pendente && scan.sensiveis.length > 0 ? (
          <p className={styles.seloSensivel}>
            <span aria-hidden="true">⚠ </span>
            {fraseDoAvisoSensivel(scan.sensiveis)}
          </p>
        ) : null}
      </div>
      <Button
        disabled={texto === '' || scan.excedido || scan.pendente}
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
        <Comparativo scan={scan} />
      </Modal>
    </div>
  );
}
