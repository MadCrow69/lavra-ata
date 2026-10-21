import { DETECTORS } from './detectors/index';
import type { DetectOptions, Finding } from './types';

/**
 * Traços e espaços tipográficos → ASCII, 1:1 (mesmo comprimento UTF-16, então os
 * deslocamentos continuam valendo no texto original). Centralizado aqui: os detectores
 * enxergam só `-` e ` `.
 */
const DASHES = /[\u2010-\u2015\u2212]/g;
const SPACES = /[\u00a0\u202f\u2007]/g;

function toScanText(text: string): string {
  return text.replace(DASHES, '-').replace(SPACES, ' ');
}

interface Candidate {
  finding: Finding;
  /** Posição do detector em `DETECTORS` (desempate por precedência). */
  rank: number;
}

/**
 * Detecta identificadores brasileiros no texto. Saída ordenada por `start` e sem
 * sobreposição: em conflito vence quem começa antes, depois o trecho mais longo, depois
 * o detector de maior precedência (ordem de `DETECTORS`).
 */
export function detect(text: string, options: DetectOptions = {}): Finding[] {
  const scan = toScanText(text);
  const allowed = options.types ? new Set(options.types) : undefined;
  const candidates: Candidate[] = [];

  DETECTORS.forEach((detector, rank) => {
    if (allowed && !allowed.has(detector.type)) return;
    // Clona: o padrão compartilhado é global e `lastIndex` é estado.
    const pattern = new RegExp(detector.pattern.source, detector.pattern.flags);
    for (let match = pattern.exec(scan); match; match = pattern.exec(scan)) {
      const raw = match[0];
      const start = match.index;
      const verdict = detector.accept(raw, scan, start);
      if (verdict.ok) {
        const end = start + raw.length;
        candidates.push({
          finding: {
            type: detector.type,
            value: text.slice(start, end),
            start,
            end,
            valid: verdict.valid,
          },
          rank,
        });
      } else {
        // Rejeitado: recomeça um caractere adiante, para o casamento largo rejeitado
        // não engolir um identificador real que começa dentro dele.
        pattern.lastIndex = start + 1;
      }
    }
  });

  candidates.sort(
    (a, b) => a.finding.start - b.finding.start || b.finding.end - a.finding.end || a.rank - b.rank,
  );

  const accepted: Finding[] = [];
  let lastEnd = 0;
  for (const { finding } of candidates) {
    // Ordenado por start: basta comparar com o fim do último aceito.
    if (finding.start >= lastEnd) {
      accepted.push(finding);
      lastEnd = finding.end;
    }
  }
  return accepted;
}
