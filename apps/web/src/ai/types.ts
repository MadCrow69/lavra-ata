/** Provedores de IA suportados. */
export const PROVEDORES = ['openai', 'gemini', 'anthropic'] as const;
export type ProviderId = (typeof PROVEDORES)[number];
