/**
 * `.vtt` FICTÍCIO no formato que as ferramentas de reunião exportam: `WEBVTT` sem cabeçalho de data
 * ou hora, cada cue com id `uuid/N-M`, tempos relativos ao começo da gravação e a fala em
 * `<v Nome>primeira linha` + linhas de continuação sem tag, fechando com `</v>`. Nomes e falas
 * inventados.
 */

const ID_BASE = '0f3c2a9e-5b1d-4c7e-9a2f-6d8b1e4c7a30';

export const FALANTES_FICTICIOS = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Elisa Rocha'] as const;

const FALAS = [
  ['Bom dia a todos, vamos começar', 'pela revisão do cronograma.'],
  ['Bom dia. O fornecedor confirmou', 'a entrega para a próxima semana.'],
  ['Preciso do contrato atualizado', 'antes de liberar o pagamento.'],
  ['Combinado, eu envio hoje', 'à tarde para o jurídico.'],
] as const;

/** `segundos` → `HH:MM:SS.mmm`. */
function tempo(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const resto = ms % 1000;
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(h)}:${dois(m)}:${dois(s)}.${String(resto).padStart(3, '0')}`;
}

/** Primeiro cue começa em 00:00:03.732; o último termina em 00:27:25.972 (≈ 27 min de duração). */
export const INICIO_PRIMEIRO_CUE_MS = 3_732;
export const FIM_ULTIMO_CUE_MS = (27 * 60 + 25) * 1000 + 972;

/**
 * `quantos` cues em rodízio entre os quatro falantes, espaçados igualmente entre o início do
 * primeiro e o fim do último.
 */
export function vttFicticio(quantos = 36): string {
  const passo = Math.floor((FIM_ULTIMO_CUE_MS - INICIO_PRIMEIRO_CUE_MS) / quantos);
  const blocos = Array.from({ length: quantos }, (_, i) => {
    const inicio = INICIO_PRIMEIRO_CUE_MS + i * passo;
    const fim = i === quantos - 1 ? FIM_ULTIMO_CUE_MS : inicio + passo - 200;
    const quem = i % FALANTES_FICTICIOS.length;
    const [primeira, continuacao] = FALAS[quem] ?? FALAS[0];
    return [
      `${ID_BASE}/${String(i + 1)}-0`,
      `${tempo(inicio)} --> ${tempo(fim)}`,
      `<v ${FALANTES_FICTICIOS[quem] ?? ''}>${primeira}`,
      `${continuacao}</v>`,
    ].join('\n');
  });
  return ['WEBVTT', '', blocos.join('\n\n'), ''].join('\n');
}
