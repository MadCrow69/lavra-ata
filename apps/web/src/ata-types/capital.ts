import type { Participante } from '../domain/draft';
import { listados, presentes } from './comum-formal';
import { textoLimpo } from './texto-modelo';

/**
 * Capital informado na ata de sócios de Ltda (D7). Puro e em inteiros: percentuais em centésimos
 * de ponto (33,33% = 3333) e quotas inteiras; nada passa por número com vírgula flutuante. É só a
 * SOMA do que a pessoa digitou, exibida como "informado": o app nunca diz se houve quórum,
 * maioria ou validade, nem confere as participações com o contrato social.
 */

export type ModoCapital = 'percentual' | 'quotas';

/** 100% em centésimos de ponto. */
export const CEM_POR_CENTO = 10000;

/** "33,33", "33.33", "25 %", "100": até três dígitos, até duas casas e `%` opcional no fim. */
const FORMATO_PERCENTUAL = /^(\d{1,3})(?:[.,](\d{1,2}))?\s*%?$/;

/** "1000" ou "1.000" (separador de milhar em grupos de três). */
const FORMATO_QUOTAS = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;

/** Percentual de 0 a 100 com até duas casas, em centésimos de ponto; senão `null`. */
export function lerPercentual(texto: string): number | null {
  const m = FORMATO_PERCENTUAL.exec(texto.trim());
  if (!m) return null;
  const casas = (m[2] ?? '').padEnd(2, '0');
  const centesimos = Number(m[1]) * 100 + Number(casas);
  return centesimos <= CEM_POR_CENTO ? centesimos : null;
}

/** Número inteiro de quotas maior que zero (com ou sem separador de milhar); senão `null`. */
export function lerQuotas(texto: string): number | null {
  const limpo = texto.trim();
  if (!FORMATO_QUOTAS.test(limpo)) return null;
  const n = Number(limpo.replaceAll('.', ''));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Inteiro com ponto de milhar: 1234567 → "1.234.567". */
function comMilhar(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 7500 → "75%", 3330 → "33,3%", 3333 → "33,33%". */
export function formatarPercentual(centesimos: number): string {
  const inteiro = Math.trunc(centesimos / 100);
  const casas = String(centesimos % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return `${comMilhar(inteiro)}${casas === '' ? '' : `,${casas}`}%`;
}

/** 1000 → "1.000". */
export function formatarQuotas(n: number): string {
  return comMilhar(n);
}

/**
 * Fração `quotas / total` em centésimos de ponto, arredondada meio para cima (1 de 3 → 3333;
 * 2 de 3 → 6667). Em `bigint`: o produto por 10.000 não perde precisão com números grandes.
 * Pré-condição: `quotas` inteiro ≥ 0 e `total` inteiro > 0 (ambos exatos); fora disso lança
 * `RangeError` — `resumirCapital` só chama com valores de `lerQuotas` e somas conferidas.
 */
export function quotasParaCentesimos(quotas: number, total: number): number {
  if (!Number.isSafeInteger(quotas) || quotas < 0 || !Number.isSafeInteger(total) || total <= 0) {
    throw new RangeError(
      `quotasParaCentesimos: quotas inteiro ≥ 0 e total inteiro > 0 (recebeu ${String(quotas)} de ${String(total)}).`,
    );
  }
  const q = BigInt(quotas);
  const t = BigInt(total);
  return Number((2n * q * BigInt(CEM_POR_CENTO) + t) / (2n * t));
}

export interface ResumoCapital {
  modo: ModoCapital;
  /**
   * Centésimos de ponto dos presentes. Modo quotas: converte a SOMA das quotas presentes uma única
   * vez (nunca soma percentuais arredondados). `null` se algum presente sem valor válido, total
   * inválido ou soma de todos acima do total — e também quando a soma de todos não é conhecida
   * (algum listado inválido): sem ela, não há como garantir que não passa do total. Zero também
   * vira `null` (digitado "0" ou arredondado, como 1 de 20.001 quotas): a ata nunca diz "0%".
   * Sem nenhum sócio listado com nome, nada foi informado: `presente` e `somaTodos` são `null`; sem
   * nenhum presente, `presente` é `null` (a ata nunca diz "0% do capital").
   */
  presente: number | null;
  /** Soma de todos os listados (centésimos no modo %, quotas no modo quotas); `null` se algum inválido. */
  somaTodos: number | null;
  totalQuotas: number | null;
  presenteQuotas: number | null;
}

/** Modo escolhido no formulário; sem escolha (ou valor desconhecido), percentual. */
export function modoCapital(dados: Record<string, string>): ModoCapital {
  return dados.modo_capital === 'quotas' ? 'quotas' : 'percentual';
}

/**
 * Soma dos valores lidos; `null` se a lista é vazia, se algum é inválido ou se a soma deixa de ser
 * inteiro exato.
 */
function somar(textos: readonly string[], ler: (texto: string) => number | null): number | null {
  if (textos.length === 0) return null;
  let soma = 0;
  for (const texto of textos) {
    const valor = ler(texto);
    if (valor === null) return null;
    soma += valor;
  }
  return Number.isSafeInteger(soma) ? soma : null;
}

/** Capital presente de 0 centésimos não vai para a ata: vira lacuna como o `null`. */
const semZero = (centesimos: number | null): number | null =>
  centesimos === 0 ? null : centesimos;

/**
 * Soma as participações informadas (`extras.participacao`) dos listados com nome e dos presentes.
 * Participante com nome em branco não entra (ainda não é um sócio da lista).
 */
export function resumirCapital(
  dados: Record<string, string>,
  participantes: readonly Participante[],
): ResumoCapital {
  const modo = modoCapital(dados);
  const valorDe = (p: Participante): string => textoLimpo(p.extras.participacao);
  const todos = listados({ participantes }).map(valorDe);
  const presentesComValor = presentes({ participantes }).map(valorDe);

  if (modo === 'percentual') {
    const somaTodos = somar(todos, lerPercentual);
    const soma = somar(presentesComValor, lerPercentual);
    const cabe = somaTodos !== null && somaTodos <= CEM_POR_CENTO;
    return {
      modo,
      presente: cabe ? semZero(soma) : null,
      somaTodos,
      totalQuotas: null,
      presenteQuotas: null,
    };
  }

  const totalQuotas = lerQuotas(textoLimpo(dados.total_quotas));
  const somaTodos = somar(todos, lerQuotas);
  const presenteQuotas = somar(presentesComValor, lerQuotas);
  const cabe = totalQuotas !== null && somaTodos !== null && somaTodos <= totalQuotas;
  return {
    modo,
    presente:
      cabe && presenteQuotas !== null
        ? semZero(quotasParaCentesimos(presenteQuotas, totalQuotas))
        : null,
    somaTodos,
    totalQuotas,
    presenteQuotas,
  };
}

/** "75%" | "750 de 1.000 quotas (75%)" | `null` (capital presente não calculável). */
export function textoCapitalPresente(r: ResumoCapital): string | null {
  if (r.presente === null) return null;
  const percentual = formatarPercentual(r.presente);
  if (r.modo === 'percentual') return percentual;
  if (r.presenteQuotas === null || r.totalQuotas === null) return null;
  return `${formatarQuotas(r.presenteQuotas)} de ${formatarQuotas(r.totalQuotas)} quotas (${percentual})`;
}
