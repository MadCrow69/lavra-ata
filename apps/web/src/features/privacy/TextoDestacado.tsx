import { Fragment } from 'react';
import styles from './destaques.module.css';
import type { Parte, Trecho } from './fatiar';
import { ehTermoSensivel } from './termos-sensiveis';

/**
 * Classe do destaque: o termo sensível tem estilo próprio; o resto (dado pessoal ou marcador)
 * usa `classePii`. Uma regra só para o comparativo e a revisão.
 */
export function classeDoTrecho(classePii: string | undefined): (trecho: object) => string {
  return (t) => (ehTermoSensivel(t) ? (styles.marcaSensivel ?? '') : (classePii ?? ''));
}

/**
 * Texto fatiado por `fatiar`: partes comuns como nós de texto e destaques em `<mark>` com a classe
 * que `classeDe` escolher para o trecho (marcador, valor original, termo sensível). Nunca HTML.
 */
export function TextoDestacado<T extends Trecho>({
  partes,
  classeDe,
}: {
  partes: readonly Parte<T>[];
  classeDe: (trecho: T) => string;
}) {
  return partes.map((p) =>
    p.trecho === null ? (
      <Fragment key={p.inicio}>{p.texto}</Fragment>
    ) : (
      <mark key={p.inicio} className={classeDe(p.trecho)}>
        {p.texto}
      </mark>
    ),
  );
}
