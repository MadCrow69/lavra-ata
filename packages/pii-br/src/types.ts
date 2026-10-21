/** Tipos de identificadores brasileiros detectados. */
export type PiiType =
  'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'CEP' | 'PLACA' | 'PIS' | 'RG' | 'CARTAO';

/** Ocorrência de um identificador no texto. */
export interface Finding {
  type: PiiType;
  /** Trecho original, como aparece no texto. */
  value: string;
  /** Posição inicial (inclusiva) no texto. */
  start: number;
  /** Posição final (exclusiva) no texto. */
  end: number;
  /** Dígitos verificadores conferem (ou o tipo não os possui). */
  valid: boolean;
}

export interface DetectOptions {
  /** Restringe a detecção a estes tipos. Padrão: todos. */
  types?: PiiType[];
}

/** Mapa de mascaramento — JSON puro, serializável. */
export interface MaskMap {
  version: 1;
  /** Marcador `[TIPO_N]` → valor original. */
  markers: Record<string, string>;
  /** Chave normalizada (`TIPO:valor`) → marcador. */
  keys: Record<string, string>;
  /** Último N usado por tipo. */
  counters: Partial<Record<PiiType, number>>;
}

/** Resultado da validação da saída do LLM. */
export interface OutputReport {
  ok: boolean;
  unknownMarkers: string[];
  malformedMarkers: string[];
  newIdentifiers: Finding[];
}
