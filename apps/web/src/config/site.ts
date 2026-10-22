import caminhos from './caminhos-codigo.json';

/** Fonte única de identidade e autoria do produto. */
export const SITE = {
  nome: 'Lavra',
  slogan: 'Atas de reunião com IA e privacidade verificável',
  autor: 'Diego Antunes',
  linkedin: 'https://www.linkedin.com/in/diego-ozorio-antunes/',
  repositorio: 'https://github.com/MadCrow69/lavra-ata',
  /** Site publicado (GitHub Pages). */
  demo: 'https://madcrow69.github.io/lavra-ata/',
  commit: __COMMIT_SHA__,
} as const;

/** Valor de `SITE.commit` fora do build do CI. */
export const COMMIT_DESENVOLVIMENTO = 'dev';

/** Quantos caracteres do SHA aparecem no rodapé. */
export const COMMIT_CURTO_TAMANHO = 7;

/** Caminhos do código-fonte (a partir da raiz do repositório) citados na interface. */
export const CAMINHOS_CODIGO = caminhos as Readonly<typeof caminhos>;

/** Ref do GitHub dos links de código: a `main` em desenvolvimento, o SHA no build do CI. */
export function refDoCodigo(commit: string = SITE.commit): string {
  return commit === COMMIT_DESENVOLVIMENTO ? 'main' : commit;
}

/** Link para um arquivo (`blob`, se o último segmento tem extensão) ou pasta (`tree`) do código. */
export function urlDoCodigo(caminho: string, commit: string = SITE.commit): string {
  const ultimo = caminho.split('/').at(-1) ?? '';
  const tipo = ultimo.includes('.') ? 'blob' : 'tree';
  return `${SITE.repositorio}/${tipo}/${refDoCodigo(commit)}/${caminho}`;
}

/** Link para a página do commit no GitHub. */
export function urlDoCommit(commit: string): string {
  return `${SITE.repositorio}/commit/${commit}`;
}
