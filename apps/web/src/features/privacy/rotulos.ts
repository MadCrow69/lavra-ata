import type { PiiType } from '@lavra/pii-br';

/** Nome de cada tipo no selo, no singular e no plural (siglas não variam). */
const ROTULOS: Record<PiiType, readonly [singular: string, plural: string]> = {
  CPF: ['CPF', 'CPF'],
  CNPJ: ['CNPJ', 'CNPJ'],
  EMAIL: ['e-mail', 'e-mails'],
  TELEFONE: ['telefone', 'telefones'],
  CEP: ['CEP', 'CEP'],
  PLACA: ['placa', 'placas'],
  PIS: ['PIS', 'PIS'],
  RG: ['RG', 'RG'],
  CARTAO: ['cartão', 'cartões'],
};

/** Ordem fixa de exibição no selo. */
const ORDEM: readonly PiiType[] = [
  'CPF',
  'CNPJ',
  'EMAIL',
  'TELEFONE',
  'CEP',
  'PLACA',
  'PIS',
  'RG',
  'CARTAO',
];

/** "2 CPF, 1 telefone" — só os tipos com ocorrência, na ordem fixa. */
export function descreverContagem(contagem: Partial<Record<PiiType, number>>): string {
  return ORDEM.flatMap((tipo) => {
    const n = contagem[tipo] ?? 0;
    if (n === 0) return [];
    const [singular, plural] = ROTULOS[tipo];
    return [`${String(n)} ${n === 1 ? singular : plural}`];
  }).join(', ');
}

/** Frase do selo de privacidade. */
export function fraseDoSelo(total: number, contagem: Partial<Record<PiiType, number>>): string {
  if (total === 0) return 'Nenhum dado pessoal estruturado encontrado';
  const quantos =
    total === 1
      ? '1 dado pessoal será protegido'
      : `${String(total)} dados pessoais serão protegidos`;
  return `${quantos} (${descreverContagem(contagem)})`;
}
