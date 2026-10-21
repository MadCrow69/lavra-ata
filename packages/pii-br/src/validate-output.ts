import { detect } from './detect';
import { DETECTORS } from './detectors/index';
import { isPiiType, mapMarkerLiterals } from './mask';
import { normalizeValue } from './normalize';
import type { Finding, MaskMap, OutputReport } from './types';

/**
 * Sobras: nome de um dos 9 tipos + separadores (`_`, `\`, espaço, hífen) + número, com
 * colchete/parêntese/chave opcional em volta. É o que o modelo deixa quando quebra o marcador
 * (`CPF_1`, `[CPF_1`, `(CPF_1)`, `[CPF__1]`, `[CPF_ 1]`) e o `unmask` não restaura. Quantificadores
 * limitados: nada de backtracking em saída longa.
 */
const LEFTOVER = new RegExp(
  String.raw`(?<open>[\[({])?(?<![\p{L}\p{N}])(?<type>${DETECTORS.map((d) => d.type).join('|')})(?<sep>[\s_\\-]{0,6})(?<n>\d{1,12})(?!\d)(?<close>[\])}])?`,
  'giu',
);

const findingKey = (f: Finding): string => `${f.type}:${normalizeValue(f.type, f.value)}`;

/**
 * Confere a saída do LLM antes do `unmask`. Usa a mesma forma tolerante de marcador do
 * `mask`/`unmask`, então os três concordam sobre o que é um marcador.
 * - `unknownMarkers`: marcadores dos 9 tipos que não existem no mapa (forma canônica, sem
 *   repetição, na ordem de aparição). Números em `map.reserved` são literais do usuário e
 *   não contam; `[TIPO#N]` (reescrita de colisão) nem casa com a forma de marcador.
 * - `malformedMarkers`: marcadores que existem no mapa mas foram escritos fora do formato
 *   canônico (`[CPF 1]`, `[cpf_1]`, `[CPF\_1]`), e também as SOBRAS que o `unmask` não
 *   restaura (`CPF_1`, `[CPF_1`, `(CPF_1)`, `[CPF__1]`, `[CPF_ 1]`): nome do tipo + número do
 *   mapa, ou colado em pontuação de marcador. Como apareceram, sem repetição, por posição.
 * - `newIdentifiers`: identificadores da saída cuja chave normalizada não aparece em
 *   `sentInput`, sem repetição (primeira ocorrência).
 *
 * `sentInput` é EXATAMENTE o texto enviado ao modelo, ou seja, o texto MASCARADO (transcrição,
 * instrução e qualquer contexto). Com o texto original, um CPF cru vazando na saída seria
 * tratado como "já presente na entrada" e passaria despercebido.
 */
export function validateOutput(output: string, map: MaskMap, sentInput: string): OutputReport {
  const unknown = new Set<string>();
  /** Malformados com a posição de aparição: a lista final sai ordenada por posição. */
  const malformed = new Map<string, number>();
  /** Trechos já reconhecidos como marcador (forma tolerante): a varredura de sobras os pula. */
  const covered: [number, number][] = [];

  mapMarkerLiterals(output, (literal, type, n, offset) => {
    covered.push([offset, offset + literal.length]);
    const name = type.toUpperCase();
    if (!isPiiType(name)) return literal;
    const canonical = `[${name}_${n}]`;
    if (Object.hasOwn(map.markers, canonical)) {
      if (literal !== canonical && !malformed.has(literal)) malformed.set(literal, offset);
    } else if (!map.reserved?.[name]?.includes(n)) {
      unknown.add(canonical);
    }
    return literal;
  });

  // Sobras: o marcador que o `unmask` NÃO restaura. Só conta se o número é de um marcador do
  // mapa (`CPF 1` com `[CPF_1]` no mapa) OU se vier colado em pontuação de marcador (`[`, `]`,
  // `_`, `\`). Assim "o CEP 01310100" na saída segue limpo.
  for (const m of output.matchAll(LEFTOVER)) {
    // `type`, `sep` e `n` sempre participam do casamento; `open` e `close` são opcionais.
    const { open, type, sep, n, close } = m.groups as {
      open?: string;
      type: string;
      sep: string;
      n: string;
      close?: string;
    };
    const end = m.index + m[0].length;
    if (covered.some(([from, to]) => m.index < to && end > from)) continue;
    const known = Object.hasOwn(map.markers, `[${type.toUpperCase()}_${n}]`);
    const punctuated = open === '[' || close === ']' || /[_\\]/.test(sep);
    if ((known || punctuated) && !malformed.has(m[0])) malformed.set(m[0], m.index);
  }

  const seen = new Set(detect(sentInput).map(findingKey));
  const newIdentifiers: Finding[] = [];
  for (const f of detect(output)) {
    const key = findingKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    newIdentifiers.push(f);
  }

  const unknownMarkers = [...unknown];
  const malformedMarkers = [...malformed].sort((a, b) => a[1] - b[1]).map(([literal]) => literal);
  return {
    ok: unknownMarkers.length === 0 && malformedMarkers.length === 0 && newIdentifiers.length === 0,
    unknownMarkers,
    malformedMarkers,
    newIdentifiers,
  };
}
