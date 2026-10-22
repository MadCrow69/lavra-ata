/** Provedores de IA suportados. */
export const PROVEDORES = ['openai', 'gemini', 'anthropic'] as const;
export type ProviderId = (typeof PROVEDORES)[number];

/**
 * Subconjunto de JSON Schema aceito pelos três provedores: só object/array/string/enum,
 * todo objeto com `additionalProperties: false` e todas as propriedades em `required`.
 */
export interface JsonSchema {
  type: 'object' | 'array' | 'string';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: JsonSchema;
  enum?: string[];
}

export interface GenerateRequest {
  sistema: string;
  usuario: string;
  schema: JsonSchema;
  nomeSchema: string;
  signal: AbortSignal;
}

export interface ProviderConfig {
  id: ProviderId;
  modelo: string;
  chave: string;
}

/** Tipos de erro de uma chamada (lista em tempo de execução para validar o rascunho salvo). */
export const ERRO_TIPOS = [
  'chave_invalida',
  'limite',
  'instavel',
  'cortado',
  'json_invalido',
  'recusa',
  'rede',
  'parametro',
  'muito_longo',
  'inesperado',
  'cancelado',
] as const;
export type ErroTipo = (typeof ERRO_TIPOS)[number];

/**
 * Por que o provedor recusou uma chave que pode estar bem copiada: conta sem crédito/saldo ou chave
 * da Anthropic sem workspace. Ausente = a chave em si foi recusada.
 */
export const MOTIVOS_RECUSA = ['sem_credito', 'sem_workspace'] as const;
export type MotivoRecusa = (typeof MOTIVOS_RECUSA)[number];

export interface ProviderAdapter {
  id: ProviderId;
  rotulo: string;
  gerar(cfg: ProviderConfig, req: GenerateRequest): Promise<unknown>;
  testarChave(cfg: Omit<ProviderConfig, 'modelo'>, signal: AbortSignal): Promise<void>;
}

export interface FalhaProvedor {
  provedor: ProviderId;
  erro: ErroTipo;
  /** Só em `chave_invalida` com motivo conhecido (sem crédito, sem workspace). */
  motivo?: MotivoRecusa;
  mensagem: string;
}

export interface ResultadoCadeia<T> {
  valor: T;
  provedor: ProviderId;
  modelo: string;
  falhas: FalhaProvedor[];
}
