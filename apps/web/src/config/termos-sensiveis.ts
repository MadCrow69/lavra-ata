/**
 * Termos que sugerem dado pessoal sensível escrito em texto livre (LGPD, Lei 13.709/2018, art. 5º,
 * II: origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato ou a
 * organização de caráter religioso, filosófico ou político, dado referente à saúde ou à vida
 * sexual, dado genético ou biométrico), mais conflito trabalhista, que não é dado sensível na lei,
 * mas expõe a pessoa citada numa ata.
 *
 * Servem SÓ para avisar antes do envio: nada aqui é mascarado. É uma lista de palavras, não uma
 * proteção; frase sensível sem termo da lista passa sem aviso.
 *
 * Termos escritos já normalizados (minúsculas, sem acento, espaço simples; um teste confere). `*`
 * no fim = prefixo (radical): `afastad*` acha "afastado", "afastada", "afastados". Termo com espaço
 * aceita qualquer espaço ou quebra de linha entre as palavras. Nada genérico demais ("tratamento",
 * "desligamento", "laudo" sozinho, "deficiência" sozinha): o aviso que dispara toda hora deixa de
 * ser lido.
 */

export interface CategoriaSensivel {
  /** Identificador estável (não aparece na tela). */
  id: string;
  /** Nome da categoria no aviso, em minúsculas ("saúde", "conflito trabalhista"). */
  rotulo: string;
  termos: readonly string[];
}

export const CATEGORIAS_SENSIVEIS: readonly CategoriaSensivel[] = [
  {
    id: 'saude',
    rotulo: 'saúde',
    termos: [
      'diagnostic*',
      'cid',
      'atestado*',
      'laudo medico',
      'laudos medicos',
      'afastad*',
      'afastamento*',
      'licenca medica',
      'licenca maternidade',
      'internad*',
      'internacao',
      'cirurgia*',
      'gestante*',
      'gravidez',
      'gravida',
      'depressao',
      'depressiv*',
      'ansiedade',
      'burnout',
      'cancer',
      'hiv',
      'pessoa com deficiencia',
      'pessoas com deficiencia',
      'pcd',
      'deficiencia fisica',
      'deficiencia visual',
      'deficiencia auditiva',
      'deficiencia intelectual',
      'medicament*',
      'tratamento medico',
      'psiquiatr*',
      'psicolog*',
      'doenca*',
    ],
  },
  {
    id: 'trabalhista',
    rotulo: 'conflito trabalhista',
    termos: [
      'processo trabalhista',
      'reclamacao trabalhista',
      'acao trabalhista',
      'justa causa',
      'assedio*',
      'advertencia disciplinar',
      'suspensao disciplinar',
      'demissao*',
      'demitid*',
    ],
  },
  {
    id: 'crenca',
    rotulo: 'filiação sindical, política ou religiosa',
    termos: [
      'sindicato*',
      'sindical*',
      'filiacao partidaria',
      'partido politico',
      'religiao',
      'religios*',
      'igreja*',
    ],
  },
  {
    id: 'origem',
    rotulo: 'origem racial ou étnica',
    termos: ['raca', 'etnia*', 'etnic*'],
  },
  {
    id: 'sexual',
    rotulo: 'vida sexual',
    termos: ['orientacao sexual', 'homossexual*', 'bissexual*', 'transgener*'],
  },
  {
    id: 'biometria',
    rotulo: 'dado genético ou biométrico',
    termos: ['biometri*', 'genetic*'],
  },
];

/**
 * Código da CID escrito depois da sigla ("CID F32", "CID-10: F32.1", "cid m54"), aplicado ao texto
 * já normalizado. Vence o termo `cid` sozinho: o trecho destacado inclui o código.
 */
export const PADRAO_CODIGO_CID = {
  categoria: 'saude',
  fonte: String.raw`cid(?:\s*-?\s*1[01])?\s*[:\-]?\s*[a-z]\d{2}(?:\.\d{1,2})?`,
} as const;

/** Quantos trechos distintos o aviso da revisão lista antes de resumir em "e mais N". */
export const MAX_TRECHOS_SENSIVEIS_VISIVEIS = 8;
