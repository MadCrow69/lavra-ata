import { useId, type ReactNode } from 'react';
import { MAX_TRECHOS_SENSIVEIS_VISIVEIS } from '../../config/termos-sensiveis';
import { plural } from '../../ui/plural';
import styles from './destaques.module.css';
import {
  categoriasDosAchados,
  rotuloDaCategoria,
  trechosDistintos,
  type TermoSensivel,
} from './termos-sensiveis';

/**
 * Aviso de que nomes seguem para a IA (comparativo "Original × Enviado à IA" e revisão antes do
 * envio). `children` completa com o que vale só naquela tela.
 */
export function AvisoNomes({ children }: { children?: ReactNode }) {
  return (
    <p className={styles.aviso}>
      <strong>Nomes de pessoas não são removidos — a ata precisa deles.</strong> Só documentos,
      contatos e cartões viram marcadores.{children === undefined ? null : <> {children}</>}
    </p>
  );
}

/** Literais com forma de marcador que a pessoa escreveu e foram reescritos. Vazio = nada. */
export function AvisoColisoes({ colisoes }: { colisoes: readonly string[] }) {
  if (colisoes.length === 0) return null;
  return (
    <p className={styles.aviso}>
      {`Atenção: ${colisoes.join(', ')} já aparece${colisoes.length === 1 ? '' : 'm'} no texto como se fosse um marcador e foi reescrito para não se confundir com os de verdade.`}
    </p>
  );
}

/**
 * Bloco da revisão antes do envio: categorias e trechos distintos (até
 * `MAX_TRECHOS_SENSIVEIS_VISIVEIS`, depois "e mais N"), com a orientação. Só aviso: nada é
 * mascarado, e a lista de palavras deixa passar muita coisa. Sem achados, nada.
 */
export function AvisoSensiveis({
  texto,
  achados,
}: {
  texto: string;
  achados: readonly TermoSensivel[];
}) {
  const tituloId = useId();
  if (achados.length === 0) return null;
  const distintos = trechosDistintos(texto, achados);
  const visiveis = distintos.slice(0, MAX_TRECHOS_SENSIVEIS_VISIVEIS);
  const resto = distintos.length - visiveis.length;
  return (
    <section className={styles.avisoSensivel} aria-labelledby={tituloId}>
      <h3 id={tituloId} className={styles.avisoSensivelTitulo}>
        <span aria-hidden="true">⚠ </span>
        {`Possível dado sensível (${categoriasDosAchados(achados).join(', ')})`}
      </h3>
      <ul className={styles.avisoSensivelLista}>
        {visiveis.map((d) => (
          <li key={d.trecho}>
            <mark className={styles.marcaSensivel}>{d.trecho}</mark>
            {` (${rotuloDaCategoria(d.categoria)})`}
          </li>
        ))}
      </ul>
      {resto > 0 ? (
        <p className={styles.avisoSensivelTexto}>
          {`e mais ${String(resto)} ${plural(resto, 'trecho', 'trechos')}`}
        </p>
      ) : null}
      <p className={styles.avisoSensivelTexto}>
        Não são mascarados. Se não forem necessários para a ata, cancele e edite a transcrição.
      </p>
      <p className={styles.avisoSensivelTexto}>
        Este aviso vem de uma lista de palavras, não é uma proteção: muita coisa sensível escrita de
        outro jeito passa sem aviso.
      </p>
    </section>
  );
}
