import { detect } from './detect';
import { DETECTORS } from './detectors/index';
import { normalizeValue } from './normalize';
import type { DetectOptions, Finding, MaskMap } from './types';

/** Forma canônica do marcador. Global: nunca use a instância compartilhada sem clonar. */
export const MARKER_PATTERN = /\[([A-Z]+)_(\d+)\]/g;

/**
 * Forma tolerante, única para `mask` (reserva e colisão) e `unmask` (reidratação): LLMs
 * mudam a caixa, trocam `_` por espaço/hífen e põem espaços internos. O separador
 * `[\s_-]?` e os `\s*` aceitam também quebra de linha. `#` NÃO é aceito de propósito:
 * `[CPF#1]` é a forma visível de um literal do usuário que colidiria com um marcador.
 */
const TOLERANT_SOURCE = '\\[\\s*([A-Za-z]+)[\\s_-]?(\\d+)\\s*\\]';

const PII_TYPE_NAMES: ReadonlySet<string> = new Set(DETECTORS.map((d) => d.type));

export interface MaskResult {
  masked: string;
  map: MaskMap;
  findings: Finding[];
  /**
   * Textos literais do usuário com forma de marcador que colidiam com um marcador JÁ
   * alocado no mapa reutilizado (ex.: `[CPF_1]`). No `masked` viram `[CPF#1]`; a app
   * deve avisar o usuário.
   */
  collisions: string[];
}

export function createMaskMap(): MaskMap {
  return { version: 1, markers: {}, keys: {}, counters: {} };
}

/** Aplica `fn` a cada texto com forma de marcador (tolerante); regex nova por chamada. */
function mapMarkerLiterals(
  text: string,
  fn: (literal: string, type: string, n: string) => string,
): string {
  return text.replace(new RegExp(TOLERANT_SOURCE, 'g'), fn);
}

/** Números (como texto, sem passar por Number) que o usuário escreveu como marcador, por tipo. */
function reservedNumbers(text: string): Map<string, Set<string>> {
  const reserved = new Map<string, Set<string>>();
  mapMarkerLiterals(text, (literal, type, n) => {
    const name = type.toUpperCase();
    if (PII_TYPE_NAMES.has(name)) {
      const set = reserved.get(name) ?? new Set<string>();
      reserved.set(name, set.add(n));
    }
    return literal;
  });
  return reserved;
}

/**
 * Troca identificadores por marcadores `[TIPO_N]`. Não muta `options.map`: devolve um mapa
 * novo. O mesmo valor normalizado reaproveita o marcador; `markers` guarda o primeiro texto
 * original visto, e `unmask` restaura nesse formato (não no de cada ocorrência).
 *
 * Texto do usuário que já tem forma de marcador de um dos 9 tipos (`[CPF_1]`, `[cpf 1]`):
 * - a numeração PULA os números que o usuário escreveu nesta entrada, então o literal nunca
 *   entra no mapa e `unmask` o deixa como está, aconteça o que acontecer com o LLM.
 *   Por isso a numeração pode ter saltos; `counters` guarda o ÚLTIMO número usado;
 * - se o literal colide com um marcador já alocado no mapa reutilizado, ele é reescrito
 *   como `[CPF#1]` (visível, não casa com o `unmask`) e listado em `collisions`.
 * Colchetes que não são desses tipos (`[Anexo 2]`) passam intactos.
 */
export function mask(text: string, options: DetectOptions & { map?: MaskMap } = {}): MaskResult {
  const base = options.map ?? createMaskMap();
  const map: MaskMap = {
    version: 1,
    markers: { ...base.markers },
    keys: { ...base.keys },
    counters: { ...base.counters },
  };
  const findings = detect(text, options.types ? { types: options.types } : {});
  const reserved = reservedNumbers(text);
  const collisions: string[] = [];

  /** Trecho fora dos achados: literais que colidem com marcador já alocado viram `[TIPO#N]`. */
  const neutralize = (gap: string): string =>
    mapMarkerLiterals(gap, (literal, type, n) => {
      if (!Object.hasOwn(base.markers, `[${type.toUpperCase()}_${n}]`)) return literal;
      if (!collisions.includes(literal)) collisions.push(literal);
      return `[${type}#${n}]`;
    });

  const pieces: string[] = [];
  let cursor = 0;
  for (const finding of findings) {
    pieces.push(neutralize(text.slice(cursor, finding.start)));
    const key = `${finding.type}:${normalizeValue(finding.type, finding.value)}`;
    let marker = Object.hasOwn(map.keys, key) ? map.keys[key] : undefined;
    if (marker === undefined) {
      let n = (map.counters[finding.type] ?? 0) + 1;
      while (reserved.get(finding.type)?.has(String(n))) n++;
      marker = `[${finding.type}_${String(n)}]`;
      map.counters[finding.type] = n;
      map.keys[key] = marker;
      map.markers[marker] = finding.value;
    }
    pieces.push(marker);
    cursor = finding.end;
  }
  pieces.push(neutralize(text.slice(cursor)));

  return { masked: pieces.join(''), map, findings, collisions };
}

/**
 * Reidrata marcadores (tolerante a grafia). Marcador desconhecido fica como está.
 * Passada única: o valor restaurado nunca é reprocessado.
 */
export function unmask(text: string, map: MaskMap): string {
  return mapMarkerLiterals(text, (match, type, n) => {
    const marker = `[${type.toUpperCase()}_${n}]`;
    return (Object.hasOwn(map.markers, marker) ? map.markers[marker] : undefined) ?? match;
  });
}
