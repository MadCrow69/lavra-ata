import { COR_TEXTO_DOCUMENTO } from './documento';

/**
 * Paleta da cor de destaque do documento (título da ata, subtítulos e títulos de seção) na folha,
 * no PDF e no DOCX. Fonte única: a tela de preferências, a folha e os exportadores leem daqui.
 * Toda cor tem contraste mínimo sobre o branco da folha e nenhuma repete a identidade do Lavra
 * (conferido por `destaque.test.ts`). O padrão é a própria tinta do texto: sem escolha, o
 * documento sai exatamente como sempre saiu.
 */

export type IdDestaque = 'grafite' | 'marinho' | 'azul' | 'verde' | 'vinho' | 'roxo';

export interface OpcaoDestaque {
  id: IdDestaque;
  rotulo: string;
  /** `#rrggbb` minúsculo. */
  cor: string;
}

export const DESTAQUES: readonly OpcaoDestaque[] = [
  { id: 'grafite', rotulo: 'Grafite (padrão)', cor: COR_TEXTO_DOCUMENTO },
  { id: 'marinho', rotulo: 'Azul-marinho', cor: '#1f3a68' },
  { id: 'azul', rotulo: 'Azul', cor: '#0b5394' },
  { id: 'verde', rotulo: 'Verde-floresta', cor: '#1e5631' },
  { id: 'vinho', rotulo: 'Vinho', cor: '#7b1e3a' },
  { id: 'roxo', rotulo: 'Roxo', cor: '#4b2e83' },
];

export const DESTAQUE_PADRAO: IdDestaque = 'grafite';

/** Contraste mínimo (WCAG AA, texto normal) de toda cor da paleta sobre o branco da folha. */
export const CONTRASTE_MINIMO_DESTAQUE = 4.5;

export function ehIdDestaque(v: unknown): v is IdDestaque {
  return DESTAQUES.some((d) => d.id === v);
}

/** Cor do destaque; id desconhecido (preferência antiga ou corrompida) cai no padrão. */
export function corDoDestaque(id: string): string {
  const achado =
    DESTAQUES.find((d) => d.id === id) ?? DESTAQUES.find((d) => d.id === DESTAQUE_PADRAO);
  return achado?.cor ?? COR_TEXTO_DOCUMENTO;
}
