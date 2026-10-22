import {
  dataOuNulo,
  ehVisivel,
  horaOuNulo,
  rotuloDaOpcao,
  rotuloDoCampo,
  textoLimpo,
} from './texto-modelo';
import type { CampoDef } from './types';

/**
 * Fonte ÚNICA dos campos de id compartilhado entre tipos (D2: mesmo id = mesmo `tipo` e mesmos
 * valores de opção; os rótulos podem mudar). Importa só de `texto-modelo.ts`, nunca do registro:
 * os tipos usam este módulo e o registro importa os tipos.
 */

/** Valores de `modalidade` em todos os tipos; cada tipo escolhe quais oferece e com que rótulo. */
export const VALORES_MODALIDADE = ['presencial', 'remota', 'hibrida'] as const;
export type Modalidade = (typeof VALORES_MODALIDADE)[number];

/** A modalidade em que a reunião acontece só por meio eletrônico (verificado contra `Modalidade`). */
export const MODALIDADE_REMOTA = 'remota' satisfies Modalidade;

/** Campo `modalidade` com as opções que têm rótulo, sempre na ordem de `VALORES_MODALIDADE`. */
export function campoModalidade(
  rotulos: Partial<Record<Modalidade, string>>,
  ajuda?: string,
): CampoDef {
  const opcoes = VALORES_MODALIDADE.flatMap((valor) => {
    const rotulo = rotulos[valor];
    return rotulo === undefined ? [] : [{ valor, rotulo }];
  });
  return {
    id: 'modalidade',
    rotulo: 'Modalidade',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes,
    erroObrigatorio: 'Informe a modalidade da reunião.',
    ...(ajuda === undefined ? {} : { ajuda }),
  };
}

/** Compartilhados entre tipos: congelados para nenhum tipo alterar o campo de outro. */
export const CAMPO_DATA: CampoDef = Object.freeze({
  id: 'data',
  rotulo: 'Data',
  tipo: 'data',
  obrigatorio: true,
  erroObrigatorio: 'Informe a data da reunião.',
});

export const CAMPO_INICIO: CampoDef = Object.freeze({
  id: 'inicio',
  rotulo: 'Início',
  tipo: 'hora',
  obrigatorio: true,
  erroObrigatorio: 'Informe o horário de início.',
});

export const CAMPO_FIM: CampoDef = Object.freeze({
  id: 'fim',
  rotulo: 'Término',
  tipo: 'hora',
  obrigatorio: false,
});

/** Campo de texto (presidente, secretário, local, plataforma…): opcional salvo `extra`. */
export function campoTexto(id: string, rotulo: string, extra: Partial<CampoDef> = {}): CampoDef {
  return { id, rotulo, tipo: 'texto', obrigatorio: false, ...extra };
}

/** `' às 16h'` para um término válido; vazio, ausente ou inválido → `''`. */
export function sufixoHora(fim: string | undefined): string {
  const hora = horaOuNulo(fim);
  return hora === null ? '' : ` às ${hora}`;
}

/** Ids impressos como "Rótulo: valor" no fim do cabeçalho, nesta ordem. */
const IDS_DE_LUGAR = ['local', 'plataforma'] as const;

/**
 * Linhas "Data: …", "Horário: …" (ou "Término: …"), "Modalidade: …" e local/plataforma (com o
 * rótulo de `rotuloDoCampo`) — só o que foi informado, é válido e pertence a um campo de `campos`
 * visível para os `dados`. Valor de um campo que o tipo não declara (vindo de outro tipo) não sai.
 */
export function cabecalhoDaReuniao(
  dados: Record<string, string>,
  campos: readonly CampoDef[],
): string[] {
  const campoVisivel = (id: string): CampoDef | null => {
    const campo = campos.find((c) => c.id === id);
    return campo !== undefined && ehVisivel(campo, dados) ? campo : null;
  };
  const valor = (id: string): string | undefined =>
    campoVisivel(id) === null ? undefined : dados[id];

  const linhas: string[] = [];
  const data = dataOuNulo(valor('data'));
  if (data !== null) linhas.push(`Data: ${data}`);

  const inicio = horaOuNulo(valor('inicio'));
  const fim = horaOuNulo(valor('fim'));
  if (inicio !== null) linhas.push(`Horário: ${fim === null ? inicio : `${inicio} às ${fim}`}`);
  else if (fim !== null) linhas.push(`Término: ${fim}`);

  const modalidade = rotuloDaOpcao(
    campoVisivel('modalidade') ?? undefined,
    textoLimpo(dados.modalidade),
  );
  if (modalidade !== null) linhas.push(`Modalidade: ${modalidade}`);

  for (const id of IDS_DE_LUGAR) {
    const campo = campoVisivel(id);
    const texto = textoLimpo(dados[id]);
    if (campo !== null && texto !== '') linhas.push(`${rotuloDoCampo(campo, dados)}: ${texto}`);
  }
  return linhas;
}
