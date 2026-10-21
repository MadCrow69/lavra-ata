// Fonte única da CSP do Lavra: o plugin do Vite injeta o <meta> no build
// e o scripts/check-csp.mjs confere o resultado contra esta mesma definição.

/** Únicas origens externas permitidas: as APIs dos provedores de IA (BYOK). */
export const PROVIDER_ORIGINS = [
  'https://api.openai.com',
  'https://generativelanguage.googleapis.com',
  'https://api.anthropic.com',
];

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${PROVIDER_ORIGINS.join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
