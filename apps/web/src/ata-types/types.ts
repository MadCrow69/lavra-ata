import type { AtaDraft, EntradaDoDocumento } from '../domain/draft';

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
  /** Erro de formato de um valor NÃO vazio; `null` = válido. */
  validar?: (valor: string, dados: Record<string, string>) => string | null;
  /** `inputMode` no celular. */
  teclado?: 'numeric' | 'decimal';
  /** Só campo de participante: o valor segue (mascarado) para a IA. Padrão: não segue (spec 5.2). */
  enviarParaIA?: boolean;
  /** Só campo de participante: peso da coluna nas tabelas do documento (padrão `PESOS_COLUNA.extra`). */
  peso?: number;
}

export interface SecaoDef {
  /** Minúsculas, dígitos e `_`, começando por letra; nunca `encaminhamentos` (chave reservada). */
  chave: string;
  titulo: string;
  /** O que a IA deve escrever nesta seção (narrativa: lista de blocos). */
  instrucao: string;
}

/** Uma pessoa na linha de assinatura. */
export interface Assinatura {
  nome: string;
  papel: string;
}

/** Assinaturas sob um título opcional (ex.: "Mesa"); `null` = sem título. */
export interface GrupoAssinaturas {
  titulo: string | null;
  pessoas: Assinatura[];
}

/** Resumo exibido sob a lista de participantes: uma linha de texto e alertas (só avisam). */
export interface ResumoParticipantes {
  texto: string | null;
  alertas: string[];
}

export interface AtaTypeDefinition {
  id: string;
  rotulo: string;
  descricao: string;
  campos: CampoDef[];
  /** Campos extras do participante, além de nome, papel e presença. */
  camposParticipante: CampoDef[];
  /** Rótulo do papel do participante, ex.: "Cargo / empresa"; `null` = sem coluna de papel. */
  rotuloPapel: string | null;
  /** Campo extra que recebe o complemento de "Nome — X" (colar e adicionar); sem ele, o papel. */
  campoComplemento?: string;
  /** Títulos dos blocos de participantes e de pauta no formulário e no documento. */
  rotulos: { participantes: string; pauta: string };
  /** Seções geradas, na ordem do documento. */
  secoes: SecaoDef[];
  temEncaminhamentos: boolean;
  /**
   * Campos do formulário enviados à IA como contexto (ex.: data, modalidade). Só metadados não
   * sensíveis: os demais (organização, local, condução…) vão direto do formulário para o documento.
   * A cópia enviada leva SÓ estes campos: o `visivelSe` deles só pode depender de campos daqui.
   */
  camposNoPrompt: string[];
  /** Regras de prompt específicas do tipo (as comuns ficam em `regras-comuns.ts`). */
  regrasPrompt: string[];
  titulo: (dados: Record<string, string>) => string;
  /** Texto fixo de abertura; dado ausente vira `[PREENCHER: …]`. */
  /**
   * Linhas do cabeçalho da ata (organização, data, horário, modalidade, local…), só com o que já
   * foi informado: o que falta não aparece (as lacunas `[PREENCHER]` ficam no preâmbulo).
   */
  cabecalho: (d: EntradaDoDocumento) => string[];
  preambulo: (d: EntradaDoDocumento) => string;
  fecho: (d: EntradaDoDocumento) => string;
  assinaturas: (d: EntradaDoDocumento) => GrupoAssinaturas[];
  /** Frases impressas depois das assinaturas, antes do aviso de minuta. */
  avisosFinais?: (d: EntradaDoDocumento) => string[];
  resumoDosParticipantes?: (
    d: Pick<AtaDraft, 'dados' | 'participantes'>,
  ) => ResumoParticipantes | null;
}

export type BlocoFormulario = 'dados' | 'participantes' | 'transcricao';

export interface CampoFaltando {
  bloco: BlocoFormulario;
  campo: string;
  rotulo: string;
}
