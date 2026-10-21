import { detect } from './detect';
import { DETECTORS } from './detectors/index';
import { normalizeValue } from './normalize';
import type { DetectOptions, Finding, MaskMap, PiiType } from './types';

/** Forma canônica do marcador. Global: nunca use a instância compartilhada sem clonar. */
export const MARKER_PATTERN = /\[([A-Z]+)_(\d+)\]/g;

/**
 * Forma tolerante, única para `mask` (reserva e colisão) e `unmask` (reidratação): LLMs
 * mudam a caixa, trocam `_` por espaço/hífen, escapam o sublinhado do markdown (`[CPF\_1]`)
 * e põem espaços internos. O separador (`\_`, `_`, espaço ou hífen) e os `\s*` aceitam também
 * quebra de linha. `#` NÃO é aceito de propósito:
 * `[CPF#1]` é a forma visível de um literal do usuário que colidiria com um marcador.
 */
const TOLERANT_SOURCE = '\\[\\s*([A-Za-z]+)(?:\\\\?_|[\\s-])?(\\d+)\\s*\\]';

const PII_TYPE_NAMES: ReadonlySet<string> = new Set(DETECTORS.map((d) => d.type));

export const isPiiType = (name: string): name is PiiType => PII_TYPE_NAMES.has(name);

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
  return { version: 1, markers: {}, keys: {}, counters: {}, reserved: {} };
}

/**
 * Aplica `fn` a cada texto com forma de marcador (tolerante); regex nova por chamada.
 * `offset` é a posição do literal em `text`.
 */
export function mapMarkerLiterals(
  text: string,
  fn: (literal: string, type: string, n: string, offset: number) => string,
): string {
  return text.replace(
    new RegExp(TOLERANT_SOURCE, 'g'),
    (literal: string, type: string, n: string, offset: number) => fn(literal, type, n, offset),
  );
}

/**
 * Reservas do mapa (aceita mapas antigos, sem `reserved`) somadas aos números que o usuário
 * escreveu como marcador nesta entrada. Números ficam como texto, sem passar por `Number`.
 */
function collectReserved(base: MaskMap, text: string): Map<PiiType, Set<string>> {
  const reserved = new Map<PiiType, Set<string>>();
  const add = (type: PiiType, n: string): void => {
    reserved.set(type, (reserved.get(type) ?? new Set<string>()).add(n));
  };
  for (const [type, numbers] of Object.entries(base.reserved ?? {})) {
    if (isPiiType(type)) for (const n of numbers) add(type, n);
  }
  mapMarkerLiterals(text, (literal, type, n) => {
    const name = type.toUpperCase();
    if (isPiiType(name)) add(name, n);
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
 *   Por isso a numeração pode ter saltos; `counters` guarda o ÚLTIMO número usado. Os números
 *   reservados ficam em `map.reserved` e valem nas chamadas seguintes com o mesmo mapa (um
 *   literal visto na chamada 1 nunca é alocado na 3); mapas sem `reserved` são aceitos;
 * - se o literal colide com um marcador já alocado no mapa reutilizado, ele é reescrito
 *   como `[CPF#1]` (visível, não casa com o `unmask`) e listado em `collisions`.
 * Colchetes que não são desses tipos (`[Anexo 2]`) passam intactos.
 * Cartão com grupo anexo (CVV) é UM valor: o mesmo cartão com CVVs diferentes recebe marcadores
 * diferentes (a chave de deduplicação inclui o anexo), e `unmask` restaura cada um exatamente.
 */
export function mask(text: string, options: DetectOptions & { map?: MaskMap } = {}): MaskResult {
  const base = options.map ?? createMaskMap();
  const map: MaskMap = {
    version: 1,
    markers: { ...base.markers },
    keys: { ...base.keys },
    counters: { ...base.counters },
    reserved: {},
  };
  const findings = detect(text, options.types ? { types: options.types } : {});
  const reserved = collectReserved(base, text);
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
  map.reserved = Object.fromEntries([...reserved].map(([type, numbers]) => [type, [...numbers]]));

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
