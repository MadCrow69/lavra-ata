import type { PiiType } from '../types';

/** Resultado da checagem de um casamento candidato. */
export interface Acceptance {
  /** O candidato deve ser tratado como identificador. */
  ok: boolean;
  /** Dígitos verificadores conferem (ou o tipo não os possui). */
  valid: boolean;
}

export interface Detector {
  type: PiiType;
  /** Sempre com flag 'g'. Quem varre deve CLONAR antes (lastIndex é estado). */
  pattern: RegExp;
  accept(raw: string, text: string, start: number): Acceptance;
}
