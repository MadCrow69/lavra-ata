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

// Hífen, meia-risca (U+2013) e hífen tipográfico (U+2010), como saem de editores e
// transcrições; espaço comum e espaço sem quebra (U+00A0). Montados por código para o
// arquivo não conter caracteres invisíveis.
const DASH = String.raw`-` + String.fromCharCode(0x2013, 0x2010);
const SP = `[ ${String.fromCharCode(0xa0)}]`;
// Separador entre blocos: até 2 espaços, um traço/ponto opcional, até 2 espaços
// (`98888 - 7777`, `(11)  98888-7777`). Limitado: nada de repetição ilimitada (ReDoS).
const SEP = String.raw`${SP}{0,2}[${DASH}.]?${SP}{0,2}`;
// Separador do número local (sem DDD): obrigatório, traço ou espaço.
const LOCAL_SEP = String.raw`(?:${SP}?[${DASH}]${SP}?|${SP})`;

// `+55`/`55` opcional | DDD (com ou sem parênteses; zero de operadora antigo opcional)
// | celular `9` (com 9 separado ou não) ou fixo `[2-8]XXX` | 4 dígitos finais.
// Fixo começa em 2-8: 2-5 é a faixa fixa; 6-8 cobre os celulares antigos de 8 dígitos.
// Números iniciados em 0 (`0800`, `0300`) NÃO casam: DDD começa em 1-9, e são linhas de
// serviço, não de pessoa.
const WITH_DDD =
  String.raw`(?:\+?55${SEP})?(?:\(0?[1-9]\d\)${SEP}|0?[1-9]\d${SEP})` +
  String.raw`(?:9${SEP}\d{4}|[2-8]\d{3})${SEP}\d{4}`;
// Sem DDD: celular `9XXXX-XXXX` | fixo `XXXX-XXXX` (traço ou espaço).
const WITHOUT_DDD = String.raw`9\d{4}${LOCAL_SEP}\d{4}|[2-8]\d{3}${LOCAL_SEP}\d{4}`;

// Bordas: nem letra/dígito colado, nem "dígito + . ou traço" antes/depois (evita pegar
// um pedaço de CPF, CNPJ ou número maior pontuado).
const PATTERN = String.raw`(?<![0-9A-Za-z]|\d[${DASH}.])(?:${WITH_DDD}|${WITHOUT_DDD})(?![0-9A-Za-z]|[${DASH}.]\d)`;

/** Sem nenhuma formatação: só celular (`DDD` + `9` + 8 dígitos), com `55` ou `0` opcional. */
const UNFORMATTED = /^(?:55|0)?[1-9]{2}9\d{8}$/;
/** Número local (sem DDD): `[5 ou 4 dígitos][separador][4 dígitos]`. */
const LOCAL = new RegExp(String.raw`^(\d{4,5})(\D+)(\d{4})$`);
const HAS_DASH = new RegExp(`[${DASH}]`);
/** DDD sem parênteses + dois blocos de 4 dígitos: `14 2026 2027` pode ser intervalo de anos. */
const TWO_YEARS = new RegExp(String.raw`^\d{2}${SEP}(?:19|20)\d{2}${SEP}(?:19|20)\d{2}$`);

export const telefone: Detector = {
  type: 'TELEFONE',
  pattern: new RegExp(PATTERN, 'g'),
  accept(raw, text, start) {
    if (/^\d+$/.test(raw)) return { ok: UNFORMATTED.test(raw), valid: true };
    const local = LOCAL.exec(raw);
    if (local) {
      // `9XXXX-XXXX` com traço é inconfundível (aceito sempre, mesmo `pedido 98765-4321`:
      // falso positivo assumido, privacidade primeiro). Demais locais exigem contexto.
      const mobileWithDash = local[1]?.length === 5 && HAS_DASH.test(local[2] ?? '');
      return { ok: mobileWithDash || hasContext(text, start, CONTEXT), valid: true };
    }
    return { ok: !TWO_YEARS.test(raw), valid: true };
  },
};
