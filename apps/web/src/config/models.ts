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
  },
};

/** Nome do provedor exibido ao usuário. */
export const ROTULO_PROVEDOR: Record<ProviderId, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
};

/** Nome curto do provedor (cabeçalho, listas compactas). */
export const ROTULO_CURTO: Record<ProviderId, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
};

/** Página oficial onde a pessoa cria a própria chave de API de cada provedor. */
export const URL_CHAVE: Record<ProviderId, string> = {
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  anthropic: 'https://platform.claude.com/settings/keys',
};

/** Espera, em ms, antes da única nova tentativa após `limite`/`instavel`. */
export const ESPERA_RETRY_MS = 2_000;

/**
 * Esforço de raciocínio do modelo. Id digitado fora de `opcoes` devolve `undefined`: o parâmetro
 * é omitido e vale o padrão do próprio provedor.
 */
export function esforcoDoModelo(provedor: ProviderId, modelo: string): string | undefined {
  return MODELOS[provedor].opcoes.find((o) => o.id === modelo)?.esforco;
}

/** Tamanho máximo aceito para um id de modelo digitado. */
export const MODELO_ID_MAX = 100;

const FORMATO_ID_MODELO = /^[A-Za-z0-9._:/-]+$/;
/** Prefixos das chaves de API dos provedores: nenhum id de modelo começa assim. */
const PARECE_CHAVE_DE_API = /^(sk-|AIza)/i;

/** Só uma chave com este tamanho mínimo é procurada dentro do id digitado (a curta daria alarme falso). */
export const CHAVE_MIN_PARA_CONFERIR = 20;

export const MSG_ID_PARECE_CHAVE =
  'Isto parece uma chave de API, não um id de modelo. Cole a chave no campo “Chave de API” e escreva aqui só o nome do modelo.';

/**
 * Por que um id de modelo digitado não pode ser usado (mensagem com causa + ação), ou `null` se
 * está bom. Em branco é válido (vale o padrão do provedor). Existe, sobretudo, para que uma chave
 * colada no campo errado nunca vire "preferência" gravada no navegador.
 */
export function erroDoIdDeModelo(id: string): string | null {
  const limpo = id.trim();
  if (limpo === '') return null;
  if (PARECE_CHAVE_DE_API.test(limpo)) {
    return MSG_ID_PARECE_CHAVE;
  }
  if (limpo.length > MODELO_ID_MAX) {
    return `O id do modelo passa de ${String(MODELO_ID_MAX)} caracteres. Confira o id na página do provedor.`;
  }
  if (!FORMATO_ID_MODELO.test(limpo)) {
    return 'O id do modelo só aceita letras, números e os símbolos . _ : / -. Remova os outros caracteres.';
  }
  return null;
}

/**
 * Como `erroDoIdDeModelo`, e também recusa um id que contenha a chave de API digitada no mesmo
 * cartão (quando ela tem pelo menos `CHAVE_MIN_PARA_CONFERIR` caracteres).
 */
export function erroDoIdDeModeloComChave(id: string, chave: string): string | null {
  const trecho = chave.trim();
  if (trecho.length >= CHAVE_MIN_PARA_CONFERIR && id.includes(trecho)) return MSG_ID_PARECE_CHAVE;
  return erroDoIdDeModelo(id);
}
