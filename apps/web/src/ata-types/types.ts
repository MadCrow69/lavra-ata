import type { AtaDraft } from '../domain/draft';

export type TipoCampo = 'texto' | 'data' | 'hora' | 'escolha' | 'textoLongo';

export interface CampoDef {
  id: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  opcoes?: { valor: string; rotulo: string }[];
  ajuda?: string;
  visivelSe?: (dados: Record<string, string>) => boolean;
  /** Mensagem exibida sob o campo obrigatório vazio. Sem ela, usa-se um texto genérico. */
  erroObrigatorio?: string;
  /** Rótulo que depende de outros campos (ex.: "Local" vira "Plataforma" na reunião remota). */
  rotuloPor?: (dados: Record<string, string>) => string;
  /** Obrigatoriedade que depende de outros campos; quando existe, vale no lugar de `obrigatorio`. */
  obrigatorioSe?: (dados: Record<string, string>) => boolean;
}

export interface SecaoDef {
  chave: string;
  titulo: string;
  /** O que a IA deve escrever nesta seção (narrativa: lista de blocos). */
  instrucao: string;
}

export interface AtaTypeDefinition {
  id: string;
  rotulo: string;
  descricao: string;
  campos: CampoDef[];
  /** Campos extras do participante, além de nome, papel e presença. */
  camposParticipante: CampoDef[];
  /** Rótulo do papel do participante, ex.: "Cargo / empresa". */
  rotuloPapel: string;
  /** Seções geradas, na ordem do documento. */
  secoes: SecaoDef[];
  temEncaminhamentos: boolean;
  /**
   * Campos do formulário enviados à IA como contexto (ex.: data, modalidade). Só metadados não
   * sensíveis: os demais (organização, local, condução…) vão direto do formulário para o documento.
   */
  camposNoPrompt: string[];
  /** Regras de prompt específicas do tipo (as comuns ficam em `regras-comuns.ts`). */
  regrasPrompt: string[];
  titulo: (dados: Record<string, string>) => string;
  /** Texto fixo de abertura; dado ausente vira `[PREENCHER: …]`. */
  preambulo: (d: AtaDraft) => string;
  fecho: (d: AtaDraft) => string;
  assinaturas: (d: AtaDraft) => { nome: string; papel: string }[];
}

export type BlocoFormulario = 'dados' | 'participantes' | 'transcricao';

export interface CampoFaltando {
  bloco: BlocoFormulario;
  campo: string;
  rotulo: string;
}
