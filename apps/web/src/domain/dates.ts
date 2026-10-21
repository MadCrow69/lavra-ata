/**
 * Datas como texto `AAAA-MM-DD` e horas `HH:MM`, formatadas por fatiamento.
 * Nada aqui usa o objeto nativo de data do JavaScript: ele interpreta a string
 * em UTC e, em fuso negativo (Brasil), devolve o dia anterior.
 */

const ANO_MINIMO_EXTENSO = 1900;
const ANO_MAXIMO_EXTENSO = 2199;

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const UNIDADES = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'catorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
] as const;

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
] as const;

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
] as const;

interface DataCivil {
  ano: number;
  mes: number;
  dia: number;
}

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

function lerData(iso: string): DataCivil {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) {
    throw new RangeError(`Data inválida: "${iso}". Use o formato AAAA-MM-DD.`);
  }
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) {
    throw new RangeError(`Data inválida: "${iso}". Esse dia não existe no calendário.`);
  }
  return { ano, mes, dia };
}

/** Número de 0 a 999 por extenso. */
function ateMil(n: number): string {
  if (n < 20) return UNIDADES[n] as string;
  if (n < 100) {
    const resto = n % 10;
    const dezena = DEZENAS[Math.floor(n / 10)] as string;
    return resto === 0 ? dezena : `${dezena} e ${UNIDADES[resto] as string}`;
  }
  if (n === 100) return 'cem';
  const resto = n % 100;
  const centena = CENTENAS[Math.floor(n / 100)] as string;
  return resto === 0 ? centena : `${centena} e ${ateMil(resto)}`;
}

/** Ano de 1000 a 2999 por extenso ("mil novecentos e noventa e nove", "dois mil e cem"). */
function anoPorExtenso(ano: number): string {
  const milhares = Math.floor(ano / 1000);
  const resto = ano % 1000;
  const prefixo = milhares === 1 ? 'mil' : `${UNIDADES[milhares] as string} mil`;
  if (resto === 0) return prefixo;
  // Pt-BR liga o "e" quando o resto é menor que 100 ou centena redonda.
  const ligaE = resto < 100 || resto % 100 === 0;
  return `${prefixo}${ligaE ? ' e ' : ' '}${ateMil(resto)}`;
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

/** '2026-10-14' → '14/10/2026'. */
export function formatarData(iso: string): string {
  lerData(iso);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** '2026-10-14' → 'Aos catorze dias do mês de outubro de dois mil e vinte e seis'. */
export function formatarDataPorExtenso(iso: string): string {
  const { ano, mes, dia } = lerData(iso);
  if (ano < ANO_MINIMO_EXTENSO || ano > ANO_MAXIMO_EXTENSO) {
    throw new RangeError(
      `Ano fora do intervalo suportado para data por extenso (${String(ANO_MINIMO_EXTENSO)} a ${String(ANO_MAXIMO_EXTENSO)}): ${String(ano)}.`,
    );
  }
  const abertura = dia === 1 ? 'Ao primeiro dia' : `Aos ${ateMil(dia)} dias`;
  return `${abertura} do mês de ${MESES[mes - 1] as string} de ${anoPorExtenso(ano)}`;
}

/** '14:30' → '14h30'; '09:00' → '9h'. */
export function formatarHora(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  const horas = m ? Number(m[1]) : NaN;
  const minutos = m ? Number(m[2]) : NaN;
  if (!m || horas > 23 || minutos > 59) {
    throw new RangeError(`Hora inválida: "${hhmm}". Use o formato HH:MM (00:00 a 23:59).`);
  }
  return minutos === 0 ? `${String(horas)}h` : `${String(horas)}h${doisDigitos(minutos)}`;
}
