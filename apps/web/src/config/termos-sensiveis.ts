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
 * no fim de uma palavra = prefixo (radical): `afastad* por` acha "afastado por", "afastada por".
 * Entre as palavras de um termo composto vale qualquer espaço, quebra de linha ou hífen
 * ("licença-maternidade"). Nada genérico demais: radical que aparece toda hora em ata corporativa,
 * de condomínio ou jurídica ("diagnóstico do sistema", "o risco foi afastado", "atestado de
 * capacidade técnica", "cão de raça", "Rua da Igreja", "laudo da vistoria") entra só com o contexto
 * que o liga a uma pessoa ("afastada por", "atestado médico"). O aviso que dispara toda hora deixa
 * de ser lido. Calibrar de verdade pede um corpus de atas reais anonimizadas.
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
      'diagnostico medico',
      'diagnosticad* com',
      'atestado medico',
      'atestados medicos',
      'laudo medico',
      'laudos medicos',
      'afastad* do trabalho',
      'afastad* por',
      'afastamento medico',
      'afastamento do trabalho',
      'afastamento por',
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
      'psicologo',
      'psicologa',
      'acompanhamento psicologico',
      'tratamento psicologico',
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
    ],
  },
  {
    id: 'origem',
    rotulo: 'origem racial ou étnica',
    termos: ['cor ou raca', 'raca negra', 'origem racial', 'etnia*', 'etnic*'],
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
 * já normalizado. A sigla sozinha não avisa ("Cid" também é nome). Os separadores são curtos e
 * limitados (`[ \t]{0,3}`): com `\s*` repetido, "CID" seguido de milhares de espaços fazia o motor
 * testar todas as divisões dos espaços (tempo quadrático, aba travada).
 */
export const PADRAO_CODIGO_CID = {
  categoria: 'saude',
  fonte: String.raw`cid(?:[ \t]{0,3}-?[ \t]{0,3}1[01])?[ \t]{0,3}[:\-]?[ \t]{0,3}[a-z]\d{2}(?:\.\d{1,2})?`,
} as const;

/** Quantos trechos distintos o aviso da revisão lista antes de resumir em "e mais N". */
export const MAX_TRECHOS_SENSIVEIS_VISIVEIS = 8;
