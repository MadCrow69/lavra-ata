import { dataOuNulo, textoLimpo } from '../ata-types/texto-modelo';
import { TIPO_NOME_ARQUIVO_MAX, SEM_DATA_NOME_ARQUIVO } from '../config/limits';

export type FormatoExportacao = 'pdf' | 'docx';

/** Como cada formato aparece para a pessoa (botões, avisos e mensagens de erro). */
export const ROTULO_FORMATO: Record<FormatoExportacao, string> = { pdf: 'PDF', docx: 'DOCX' };

/** Tipo da ata em ASCII minúsculo: sem acento, só `a-z0-9` e hífens, até o limite. */
function tipoSeguro(tipoId: string): string {
  return tipoId
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, TIPO_NOME_ARQUIVO_MAX)
    .replace(/-+$/g, '');
}

/**
 * `ata-<tipo>-<data>.<ext>`, sempre em ASCII (anexo de e-mail e Windows sem surpresa). Data
 * inválida ou vazia vira `sem-data`; tipo vazio é omitido.
 */
export function nomeDoArquivo(
  tipoId: string,
  dataIso: string | undefined,
  formato: FormatoExportacao,
): string {
  const aparada = textoLimpo(dataIso);
  const data = dataOuNulo(aparada) !== null ? aparada : SEM_DATA_NOME_ARQUIVO;
  const partes = ['ata', tipoSeguro(tipoId), data].filter((parte) => parte !== '');
  return `${partes.join('-')}.${formato}`;
}
