import type { ProviderId } from '../ai/types';

export interface OpcaoModelo {
  id: string;
  rotulo: string;
  /** Esforço de raciocínio enviado a este modelo; ausente = o provedor não usa o parâmetro. */
  esforco?: string;
}

export interface ModelosDoProvedor {
  /** Id do modelo padrão (o menor/mais econômico); a pessoa pode escolher outro ou digitar um id. */
  padrao: string;
  opcoes: OpcaoModelo[];
  /** Teto de tokens de saída (inclui o raciocínio do modelo). */
  maxSaida: number;
  /** Esforço enviado a um id digitado que não está em `opcoes`. */
  esforcoPadrao?: string;
}

/** Fonte única de modelos e parâmetros por provedor. Os valores de esforço mudam por modelo. */
export const MODELOS: Record<ProviderId, ModelosDoProvedor> = {
  openai: {
    padrao: 'gpt-6-luna',
    opcoes: [
      { id: 'gpt-6-luna', rotulo: 'GPT-6 Luna', esforco: 'none' },
      { id: 'gpt-6.1-sol', rotulo: 'GPT-6.1 Sol', esforco: 'low' },
    ],
    maxSaida: 16_000,
    esforcoPadrao: 'none',
  },
  gemini: {
    padrao: 'gemini-3.8-flash',
    opcoes: [
      { id: 'gemini-3.8-flash', rotulo: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.5-flash-lite', rotulo: 'Gemini 3.5 Flash-Lite' },
    ],
    maxSaida: 16_000,
  },
  anthropic: {
    padrao: 'claude-haiku-5-5',
    opcoes: [
      { id: 'claude-haiku-5-5', rotulo: 'Claude Haiku 5.5', esforco: 'low' },
      { id: 'claude-sonnet-5-5', rotulo: 'Claude Sonnet 5.5', esforco: 'low' },
      { id: 'claude-opus-5-5', rotulo: 'Claude Opus 5.5', esforco: 'low' },
    ],
    maxSaida: 16_000,
    esforcoPadrao: 'low',
  },
};

/** Nome do provedor exibido ao usuário. */
export const ROTULO_PROVEDOR: Record<ProviderId, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
};

/** Espera, em ms, antes da única nova tentativa após `limite`/`instavel`. */
export const ESPERA_RETRY_MS = 2_000;

/** Esforço de raciocínio do modelo; id fora da lista usa o esforço padrão do provedor. */
export function esforcoDoModelo(provedor: ProviderId, modelo: string): string | undefined {
  const conf = MODELOS[provedor];
  const opcao = conf.opcoes.find((o) => o.id === modelo);
  return opcao ? opcao.esforco : conf.esforcoPadrao;
}
