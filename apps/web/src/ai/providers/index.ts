import type { ProviderAdapter, ProviderId } from '../types';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { openaiAdapter } from './openai';

/** Registro dos adaptadores, indexado pelo id do provedor. */
export const ADAPTADORES: Record<ProviderId, ProviderAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  anthropic: anthropicAdapter,
};
