import { detect } from './detect';
import { normalizeValue } from './normalize';
import type { DetectOptions, Finding, MaskMap } from './types';

/** Forma canônica do marcador. Global: nunca use a instância compartilhada sem clonar. */
export const MARKER_PATTERN = /\[([A-Z]+)_(\d+)\]/g;

/**
 * Forma tolerante (LLMs mudam caixa, trocam `_` por espaço/hífen, põem espaços internos).
 * O grupo 1 captura zero ou mais U+200B logo após `[`: é o escape de texto do usuário que
 * já tem forma de marcador (ver `escapeLiteralMarkers`).
 */
const TOLERANT_SOURCE = '\\[(\\u200B*)(\\s*([A-Za-z]+)[\\s_-]?(\\d+)\\s*)\\]';

const ZWSP = '​';

export function createMaskMap(): MaskMap {
  return { version: 1, markers: {}, keys: {}, counters: {} };
}

/**
 * Texto do USUÁRIO com forma de marcador (`[CPF_1]`, `[cpf 1]`…) ganha um U+200B após o
 * `[`: o `unmask` não o reconhece como marcador (não troca por dado de ninguém) e remove
 * exatamente um U+200B na volta. Vale também se o usuário já tinha U+200B ali (cada ida
 * acrescenta um, cada volta tira um). Só os trechos FORA dos achados passam por aqui.
 */
function escapeLiteralMarkers(gap: string): string {
  return gap.replace(new RegExp(TOLERANT_SOURCE, 'g'), (_m, zeros: string, rest: string) => {
    return `[${ZWSP}${zeros}${rest}]`;
  });
}

/**
 * Troca identificadores por marcadores `[TIPO_N]`. Não muta `options.map`: devolve um mapa
 * novo. O mesmo valor normalizado reaproveita o marcador; `markers` guarda o primeiro texto
 * original visto.
 */
export function mask(
  text: string,
  options: DetectOptions & { map?: MaskMap } = {},
): { masked: string; map: MaskMap; findings: Finding[] } {
  const base = options.map ?? createMaskMap();
  const map: MaskMap = {
    version: 1,
    markers: { ...base.markers },
    keys: { ...base.keys },
    counters: { ...base.counters },
  };
  const findings = detect(text, options.types ? { types: options.types } : {});

  const pieces: string[] = [];
  let cursor = 0;
  for (const finding of findings) {
    pieces.push(escapeLiteralMarkers(text.slice(cursor, finding.start)));
    const key = `${finding.type}:${normalizeValue(finding.type, finding.value)}`;
    let marker = Object.hasOwn(map.keys, key) ? map.keys[key] : undefined;
    if (marker === undefined) {
      const n = (map.counters[finding.type] ?? 0) + 1;
      marker = `[${finding.type}_${String(n)}]`;
      map.counters[finding.type] = n;
      map.keys[key] = marker;
      map.markers[marker] = finding.value;
    }
    pieces.push(marker);
    cursor = finding.end;
  }
  pieces.push(escapeLiteralMarkers(text.slice(cursor)));

  return { masked: pieces.join(''), map, findings };
}

/**
 * Reidrata marcadores (tolerante a grafia). Marcador desconhecido fica como está; marcador
 * escapado pelo `mask` volta ao texto original do usuário. Passada única: o valor
 * restaurado nunca é reprocessado.
 */
export function unmask(text: string, map: MaskMap): string {
  return text.replace(
    new RegExp(TOLERANT_SOURCE, 'g'),
    (match, zeros: string, rest: string, type: string, n: string) => {
      if (zeros !== '') return `[${zeros.slice(1)}${rest}]`;
      const marker = `[${type.toUpperCase()}_${n}]`;
      return (Object.hasOwn(map.markers, marker) ? map.markers[marker] : undefined) ?? match;
    },
  );
}
