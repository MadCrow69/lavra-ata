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
 * - `newIdentifiers`: identificadores da saída cuja chave normalizada não aparece em
 *   `sentInput`, sem repetição (primeira ocorrência).
 *
 * `sentInput` é EXATAMENTE o texto enviado ao modelo, ou seja, o texto MASCARADO (transcrição,
 * instrução e qualquer contexto). Com o texto original, um CPF cru vazando na saída seria
 * tratado como "já presente na entrada" e passaria despercebido.
 */
export function validateOutput(output: string, map: MaskMap, sentInput: string): OutputReport {
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

  const seen = new Set(detect(sentInput).map(findingKey));
  const newIdentifiers: Finding[] = [];
  for (const f of detect(output)) {
    const key = findingKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    newIdentifiers.push(f);
  }

  const unknownMarkers = [...unknown];
  const malformedMarkers = [...malformed];
  return {
    ok: unknownMarkers.length === 0 && malformedMarkers.length === 0 && newIdentifiers.length === 0,
    unknownMarkers,
    malformedMarkers,
    newIdentifiers,
  };
}
