import { hasContext } from '../context';
import type { Detector } from './types';

// Singular e plural: `hasContext` não aceita plural, e "as placas ABC-1234 e DEF-5678"
// é fala comum.
const CONTEXT = [
  'placa',
  'placas',
  'veiculo',
  'veículo',
  'veiculos',
  'veículos',
  'carro',
  'carros',
  'moto',
  'motos',
  'caminhao',
  'caminhão',
  'caminhoes',
  'caminhões',
] as const;

const OLD_PLATE = /^[A-Za-z]{3}[- ]?\d{4}$/;

export const placa: Detector = {
  type: 'PLACA',
  // Mercosul `ABC1D23` | antiga `ABC-1234` / `ABC1234` / `ABC 1234`.
  pattern: /(?<![0-9A-Za-z])(?:[A-Za-z]{3}[- ]?\d{4}|[A-Za-z]{3}\d[A-Za-z]\d{2})(?![0-9A-Za-z])/g,
  accept(raw, text, start) {
    // Antiga colide com códigos comuns (`ISO-9001`): só com contexto. Mercosul tem forma
    // quase inconfundível: sempre em caixa alta; em minúsculas/mista, só com contexto.
    const needsContext = OLD_PLATE.test(raw) || raw !== raw.toUpperCase();
    return { ok: !needsContext || hasContext(text, start, CONTEXT), valid: true };
  },
};
