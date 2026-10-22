/**
 * `.vtt` FICTÍCIO no formato exportado por ferramentas de reunião: `WEBVTT` sem data nem hora,
 * cue com id `uuid/N-M`, `<v Nome>primeira linha` + continuação sem tag fechando com `</v>`.
 * Três pessoas inventadas; uma delas aparece também em maiúsculas (a mesma pessoa, outra grafia).
 */

const ID = '7c1e4b2a-93d5-4f60-8a1b-2e9d0c5f3b71';

/** Na ordem da primeira fala; "MARINA TELES" (cue 4) é a mesma Marina Teles. */
export const FALANTES_VTT = ['Marina Teles', 'Otávio Brandão', 'Rita Campos'] as const;

const CUES: readonly [string, string, string, string, string][] = [
  [
    '00:00:02.120',
    '00:00:07.480',
    'Marina Teles',
    'Bom dia, vamos abrir a reunião',
    'com o cronograma da obra.',
  ],
  [
    '00:00:08.010',
    '00:00:14.300',
    'Otávio Brandão',
    'O orçamento da segunda etapa',
    'chegou ontem à noite.',
  ],
  [
    '00:12:40.500',
    '00:12:49.950',
    'Rita Campos',
    'Preciso da planilha revisada',
    'até sexta-feira.',
  ],
  [
    '00:25:03.000',
    '00:25:10.640',
    'MARINA TELES',
    'Combinado, eu envio a planilha',
    'para todos hoje.',
  ],
  [
    '00:41:39.200',
    '00:41:47.900',
    'Otávio Brandão',
    'Então encerramos por aqui,',
    'obrigado a todos.',
  ],
];

/** Duração: 00:41:47.900 − 00:00:02.120 = 41 min 45,78 s → 42 min. */
export const DURACAO_VTT_MIN = 42;

export const VTT_REUNIAO = [
  'WEBVTT',
  '',
  ...CUES.flatMap(([inicio, fim, nome, primeira, continuacao], i) => [
    `${ID}/${String(i + 1)}-0`,
    `${inicio} --> ${fim}`,
    `<v ${nome}>${primeira}`,
    `${continuacao}</v>`,
    '',
  ]),
].join('\n');
