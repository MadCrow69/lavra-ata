import { Fragment } from 'react';
import type { Parte, Trecho } from './fatiar';

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
