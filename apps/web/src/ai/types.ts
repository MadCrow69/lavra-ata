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

export type ErroTipo =
  | 'chave_invalida'
  | 'limite'
  | 'instavel'
  | 'cortado'
  | 'json_invalido'
  | 'recusa'
  | 'rede'
  | 'parametro'
  | 'cancelado';

export interface ProviderAdapter {
  id: ProviderId;
  rotulo: string;
  gerar(cfg: ProviderConfig, req: GenerateRequest): Promise<unknown>;
  testarChave(cfg: Omit<ProviderConfig, 'modelo'>, signal: AbortSignal): Promise<void>;
}

export interface FalhaProvedor {
  provedor: ProviderId;
  erro: ErroTipo;
  mensagem: string;
}

export interface ResultadoCadeia<T> {
  valor: T;
  provedor: ProviderId;
  modelo: string;
  falhas: FalhaProvedor[];
}
