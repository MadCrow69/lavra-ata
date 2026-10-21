import { mask, type Finding, type MaskMap, type PiiType } from '@lavra/pii-br';
import { useEffect, useMemo, useState } from 'react';
import { transcricaoExcedeLimite } from '../../ata-types/registry';
import { DEBOUNCE_DETECCAO_MS } from '../../config/limits';

export interface PrivacyScan {
  /** Ocorrências por tipo. */
  contagem: Partial<Record<PiiType, number>>;
  total: number;
  /** Texto como a IA o receberá. */
  mascarado: string;
  /** Texto que foi analisado (`mascarado` e `achados` valem para ele, não para o digitado depois). */
  analisado: string;
  /** Texto acima de `LIMITE_TRANSCRICAO`: não é analisado (seria custo sem uso, a geração fica bloqueada). */
  excedido: boolean;
  /** Há digitação ainda não analisada: os demais campos refletem o texto de antes. */
  pendente: boolean;
  /** Ocorrências, com posição no texto original. */
  achados: Finding[];
  /** Trechos do usuário parecidos com marcador que foram reescritos (`[CPF_1]` → `[CPF#1]`). */
  colisoes: string[];
}

/** Resultado de um texto vazio: não passa pelo debounce nem pelo `mask`. */
const VAZIO: Omit<PrivacyScan, 'pendente' | 'excedido'> = {
  analisado: '',
  contagem: {},
  total: 0,
  mascarado: '',
  achados: [],
  colisoes: [],
};

export function contarPorTipo(achados: readonly Finding[]): Partial<Record<PiiType, number>> {
  const contagem: Partial<Record<PiiType, number>> = {};
  for (const a of achados) contagem[a.type] = (contagem[a.type] ?? 0) + 1;
  return contagem;
}

/**
 * Prévia do mascaramento: acima do limite não roda; abaixo, roda `mask` só depois que a digitação parou por `DEBOUNCE_DETECCAO_MS`
 * (a transcrição pode ter centenas de milhares de caracteres). Usa o mapa do rascunho para que
 * os marcadores mostrados sejam os mesmos que a IA receberá. Nunca altera o rascunho.
 */
export function usePrivacyScan(texto: string, mapa?: MaskMap | null): PrivacyScan {
  const excedido = transcricaoExcedeLimite(texto);
  const [analisado, setAnalisado] = useState(excedido ? '' : texto);

  useEffect(() => {
    if (excedido || texto === analisado) return;
    const timer = setTimeout(() => {
      setAnalisado(texto);
    }, DEBOUNCE_DETECCAO_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [texto, analisado, excedido]);

  // Texto vazio não espera o debounce: não há o que analisar.
  const base = texto === '' || excedido ? '' : analisado;
  const resultado = useMemo(() => {
    if (base === '') return VAZIO;
    const r = mask(base, mapa ? { map: mapa } : {});
    return {
      analisado: base,
      contagem: contarPorTipo(r.findings),
      total: r.findings.length,
      mascarado: r.masked,
      achados: r.findings,
      colisoes: r.collisions,
    };
  }, [base, mapa]);

  return { ...resultado, excedido, pendente: !excedido && texto !== base };
}
