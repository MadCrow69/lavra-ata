import type { MaskMap } from '@lavra/pii-br';
import type { ProviderId } from '../ai/types';

export const PRESENCAS = ['presente', 'ausente', 'justificado'] as const;
export type Presenca = (typeof PRESENCAS)[number];

/** Nome de cada presença exibido ao usuário e enviado à IA. */
export const ROTULO_PRESENCA: Record<Presenca, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Ausência justificada',
};

export const TONS = ['formal', 'conciso', 'detalhado'] as const;
export type Tom = (typeof TONS)[number];

export interface Participante {
  /** Identidade do participante: nunca casar por nome. */
  id: string;
  nome: string;
  papel: string;
  presenca: Presenca;
  justificativa: string;
  extras: Record<string, string>;
}

export const TIPOS_BLOCO = ['paragrafo', 'lista'] as const;
export type TipoBloco = (typeof TIPOS_BLOCO)[number];

export interface Bloco {
  tipo: TipoBloco;
  texto: string;
  itens: string[];
}

export const STATUS_ENCAMINHAMENTO = [
  'pendente',
  'em_andamento',
  'concluido',
  'cancelado',
] as const;
export type StatusEncaminhamento = (typeof STATUS_ENCAMINHAMENTO)[number];

export interface Encaminhamento {
  acao: string;
  responsavel: string;
  prazo: string;
  status: StatusEncaminhamento;
}

export interface Atribuicao {
  provedor: ProviderId;
  modelo: string;
  fallbackDe: ProviderId[];
}

/**
 * `atribuicao` e `avisos` usam a chave da seção (`'encaminhamentos'` incluso). `avisos` tem ainda
 * a chave `CHAVE_AVISOS_GERAIS` para o que vale para a ata toda (ex.: colisão de marcador).
 */
export interface ResultadoAta {
  secoes: Record<string, Bloco[]>;
  encaminhamentos: Encaminhamento[];
  atribuicao: Record<string, Atribuicao>;
  avisos: Record<string, string[]>;
  /** Seções alteradas à mão. */
  editadas: string[];
}

/** Estado serializável da ata. Não tem campo de chave de API, de propósito. */
export interface AtaDraft {
  versao: 1;
  tipoId: string;
  tom: Tom;
  /** Campos do tipo de ata: datas `AAAA-MM-DD`, horas `HH:MM`. */
  dados: Record<string, string>;
  pauta: string[];
  participantes: Participante[];
  transcricao: string;
  /** Mesmo mapa de mascaramento durante todo o rascunho. */
  mapa: MaskMap | null;
  resultado: ResultadoAta | null;
}

export type DraftAction =
  | { type: 'definirTipo'; tipoId: string }
  | { type: 'definirTom'; tom: Tom }
  | { type: 'definirCampo'; campo: string; valor: string }
  | { type: 'definirPauta'; itens: string[] }
  | {
      type: 'adicionarParticipantes';
      nomes: string[];
      /** Cargo/empresa de cada nome, pela mesma posição de `nomes` (opcional). */
      papeis?: string[];
    }
  | { type: 'atualizarParticipante'; id: string; patch: Partial<Participante> }
  | { type: 'removerParticipante'; id: string }
  | { type: 'definirTranscricao'; texto: string }
  | { type: 'registrarResultado'; resultado: ResultadoAta; mapa: MaskMap }
  | {
      type: 'substituirSecao';
      chave: string;
      blocos: Bloco[];
      avisos: string[];
      /** `null` = edição manual (marca a seção em `editadas`). */
      atribuicao: Atribuicao | null;
      mapa: MaskMap | null;
    }
  | {
      type: 'substituirEncaminhamentos';
      itens: Encaminhamento[];
      avisos: string[];
      atribuicao: Atribuicao | null;
      mapa: MaskMap | null;
    }
  | { type: 'novaAta' };
