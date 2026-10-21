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
 * sobreposição. Candidatos são avaliados por início, depois trecho mais longo, depois
 * precedência (ordem de `DETECTORS`); o primeiro define tipo e `valid`. Quem fica contido
 * nele é descartado; quem o ultrapassa em parte estende o trecho (união, sem vazar o resto).
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
        // Cartão: janelas sobrepostas também são coletadas (`start + 1`), para que um
        // grupo de 4 dígitos antes do cartão não esconda o cartão real nem deixe
        // dígitos finais de fora. Os demais tipos retomam no fim do casamento.
        if (detector.type === 'CARTAO') pattern.lastIndex = start + 1;
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

  // Fail-closed: contido no último aceito é descartado; sobreposição parcial ESTENDE o
  // último aceito até o fim do candidato (união), em vez de largar o resto sem máscara.
  const accepted: Finding[] = [];
  for (const { finding } of candidates) {
    const last = accepted.at(-1);
    if (!last || finding.start >= last.end) {
      accepted.push(finding);
    } else if (finding.end > last.end) {
      last.end = finding.end;
      last.value = text.slice(last.start, last.end);
    }
  }
  return accepted;
}
