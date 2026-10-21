import { detect } from './detect';
import { isPiiType, mapMarkerLiterals } from './mask';
import { normalizeValue } from './normalize';
import type { Finding, MaskMap, OutputReport } from './types';

const findingKey = (f: Finding): string => `${f.type}:${normalizeValue(f.type, f.value)}`;

/**
 * Confere a saída do LLM antes do `unmask`. Usa a mesma forma tolerante de marcador do
 * `mask`/`unmask`, então os três concordam sobre o que é um marcador.
 * - `unknownMarkers`: marcadores dos 9 tipos que não existem no mapa (forma canônica, sem
 *   repetição, na ordem de aparição). Números em `map.reserved` são literais do usuário e
 *   não contam; `[TIPO#N]` (reescrita de colisão) nem casa com a forma de marcador.
 * - `malformedMarkers`: marcadores que existem no mapa mas foram escritos fora do formato
 *   canônico (`[CPF 1]`, `[cpf_1]`), como apareceram, sem repetição.
 * - `newIdentifiers`: identificadores da saída cuja chave normalizada não aparece na entrada.
 */
export function validateOutput(output: string, map: MaskMap, originalInput: string): OutputReport {
  const unknown = new Set<string>();
  const malformed = new Set<string>();

  mapMarkerLiterals(output, (literal, type, n) => {
    const name = type.toUpperCase();
    if (!isPiiType(name)) return literal;
    const canonical = `[${name}_${n}]`;
    if (Object.hasOwn(map.markers, canonical)) {
      if (literal !== canonical) malformed.add(literal);
    } else if (!map.reserved?.[name]?.includes(n)) {
      unknown.add(canonical);
    }
    return literal;
  });

  const known = new Set(detect(originalInput).map(findingKey));
  const newIdentifiers = detect(output).filter((f) => !known.has(findingKey(f)));

  const unknownMarkers = [...unknown];
  const malformedMarkers = [...malformed];
  return {
    ok: unknownMarkers.length === 0 && malformedMarkers.length === 0 && newIdentifiers.length === 0,
    unknownMarkers,
    malformedMarkers,
    newIdentifiers,
  };
}
