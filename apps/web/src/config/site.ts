/** Fonte única de identidade e autoria do produto. */
export const SITE = {
  nome: 'Lavra',
  slogan: 'Atas de reunião com IA e privacidade verificável',
  autor: 'Diego Antunes',
  linkedin: 'https://www.linkedin.com/in/diego-ozorio-antunes/',
  repositorio: 'https://github.com/MadCrow69/lavra-ata',
  commit: __COMMIT_SHA__,
} as const;

/** Valor de `SITE.commit` fora do build do CI. */
export const COMMIT_DESENVOLVIMENTO = 'dev';

/** Quantos caracteres do SHA aparecem no rodapé. */
export const COMMIT_CURTO_TAMANHO = 7;
