import type { Detector } from '../src/detectors/types';

/** Executa o detector sobre o texto e devolve `[trecho, valid][]` dos casamentos aceitos. */
export function run(detector: Detector, text: string): [string, boolean][] {
  // Clona o padrão: nunca reaproveita o lastIndex de uma RegExp global entre chamadas.
  const pattern = new RegExp(detector.pattern.source, detector.pattern.flags);
  const results: [string, boolean][] = [];
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const verdict = detector.accept(raw, text, match.index);
    if (verdict.ok) results.push([raw, verdict.valid]);
  }
  return results;
}
