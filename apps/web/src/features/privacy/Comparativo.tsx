import { findMarkers } from '@lavra/pii-br';
import { useMemo } from 'react';
import { AvisoColisoes, AvisoNomes } from './avisos';
import styles from './destaques.module.css';
import { fatiar, mesclarTrechos } from './fatiar';
import { detectarTermosSensiveis } from './termos-sensiveis';
import { classeDoTrecho, TextoDestacado } from './TextoDestacado';
import type { PrivacyScan } from './usePrivacyScan';

/**
 * "Original × Enviado à IA": a transcrição com os dados pessoais destacados ao lado da versão
 * mascarada. Termos de possível dado sensível ficam destacados nas duas colunas (o dado pessoal
 * vence a sobreposição). Carregado sob demanda (só abre em "Ver o que vai para a IA").
 */
export function Comparativo({ scan }: { scan: PrivacyScan }) {
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
          Trechos com sublinhado tracejado são possível dado sensível: não viram marcador e vão como
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
            <TextoDestacado partes={original} classeDe={classeDoTrecho(styles.marcaOriginal)} />
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
            <TextoDestacado partes={enviado} classeDe={classeDoTrecho(styles.marca)} />
          </div>
        </section>
      </div>
    </div>
  );
}
