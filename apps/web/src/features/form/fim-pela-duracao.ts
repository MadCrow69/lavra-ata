import { horaOuNulo } from '../../ata-types/texto-modelo';
import { formatarDuracao, somarMinutos } from '../../domain/dates';

const MS_POR_MINUTO = 60_000;

/** Duração do .vtt (ms) → minutos inteiros, arredondados; menos de meio minuto → `null`. */
export function minutosDaDuracao(ms: number | null): number | null {
  if (ms === null) return null;
  const minutos = Math.round(ms / MS_POR_MINUTO);
  return minutos > 0 ? minutos : null;
}

/** O que o bloco 2 diz sobre o término, a partir da duração da transcrição. */
export type SugestaoDoFim =
  /** `fim` em `HH:MM` (valor do campo); `duracao` e `inicio` já formatados para leitura. */
  | { tipo: 'preencher'; duracao: string; inicio: string; fim: string }
  | { tipo: 'semInicio'; duracao: string }
  | { tipo: 'passaDaMeiaNoite'; duracao: string; inicio: string };

/**
 * Sugestão do término = início + duração da gravação. Nada a dizer sem duração ou com o término já
 * preenchido (nunca é sobrescrito). Os tempos do .vtt são relativos: sem início, só a duração.
 */
export function sugerirFim(
  duracaoMin: number | null,
  inicio: string | undefined,
  fim: string | undefined,
): SugestaoDoFim | null {
  if (duracaoMin === null || (fim ?? '').trim() !== '') return null;
  const duracao = formatarDuracao(duracaoMin);
  const inicioLegivel = horaOuNulo(inicio);
  if (inicio === undefined || inicioLegivel === null) return { tipo: 'semInicio', duracao };
  const soma = somarMinutos(inicio, duracaoMin);
  return soma === null
    ? { tipo: 'passaDaMeiaNoite', duracao, inicio: inicioLegivel }
    : { tipo: 'preencher', duracao, inicio: inicioLegivel, fim: soma };
}

export function textoDaSugestaoDoFim(s: SugestaoDoFim): string {
  switch (s.tipo) {
    case 'preencher':
      return `A transcrição dura ${s.duracao}.`;
    case 'semInicio':
      return `A transcrição dura ${s.duracao} — preencha o início para sugerirmos o término.`;
    case 'passaDaMeiaNoite':
      return `A transcrição dura ${s.duracao}: somada ao início (${s.inicio}), passaria da meia-noite. Preencha o término à mão.`;
  }
}
