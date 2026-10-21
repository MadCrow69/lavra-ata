import { hasContext } from '../context';
import type { Detector } from './types';

/** Rótulos que autorizam o número local (sem DDD) no formato `XXXX-XXXX`. */
const CONTEXT = [
  'telefone',
  'fone',
  'tel',
  'celular',
  'whatsapp',
  'zap',
  'contato',
  'ligue',
  'ligar',
] as const;

const SEP = '[ .-]?';
// `+55`/`55` opcional | DDD (com ou sem parênteses; zero de operadora antigo opcional)
// | celular `9` (com 9 separado ou não) ou fixo `[2-8]XXX` | 4 dígitos finais.
// Fixo começa em 2-8: 2-5 é a faixa fixa; 6-8 cobre os celulares antigos de 8 dígitos.
// Números iniciados em 0 (`0800`, `0300`) NÃO casam: DDD começa em 1-9, e são linhas de
// serviço, não de pessoa.
const WITH_DDD =
  String.raw`(?:\+?55${SEP})?(?:\(0?[1-9]\d\)${SEP}|0?[1-9]\d${SEP})` +
  String.raw`(?:9${SEP}\d{4}|[2-8]\d{3})${SEP}\d{4}`;
// Sem DDD, só hifenizados: celular `9XXXX-XXXX` | fixo `XXXX-XXXX`.
const WITHOUT_DDD = String.raw`9\d{4}-\d{4}|[2-8]\d{3}-\d{4}`;

// Bordas: nem letra/dígito colado, nem "dígito + . ou -" antes/depois (evita pegar um
// pedaço de CPF, CNPJ ou número maior pontuado).
const PATTERN = String.raw`(?<![0-9A-Za-z]|\d[.\-])(?:${WITH_DDD}|${WITHOUT_DDD})(?![0-9A-Za-z]|[.\-]\d)`;

/** Sem nenhuma formatação: só celular (`DDD` + `9` + 8 dígitos), com `55` ou `0` opcional. */
const UNFORMATTED = /^(?:55|0)?[1-9]{2}9\d{8}$/;
/** Fixo local `XXXX-XXXX` (sem DDD). */
const LOCAL_FIXED = /^\d{4}-\d{4}$/;
/** DDD sem parênteses + dois blocos de 4 dígitos: `14 2026 2027` pode ser intervalo de anos. */
const TWO_YEARS = /^\d{2}[ .-]?((?:19|20)\d{2})[ .-]?((?:19|20)\d{2})$/;

export const telefone: Detector = {
  type: 'TELEFONE',
  pattern: new RegExp(PATTERN, 'g'),
  accept(raw, text, start) {
    if (/^\d+$/.test(raw)) return { ok: UNFORMATTED.test(raw), valid: true };
    if (LOCAL_FIXED.test(raw)) return { ok: hasContext(text, start, CONTEXT), valid: true };
    return { ok: !TWO_YEARS.test(raw), valid: true };
  },
};
