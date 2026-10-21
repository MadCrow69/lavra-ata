import type { ReactNode } from 'react';

export interface LinkExternoProps {
  href: string;
  children: ReactNode;
}

/**
 * Link que abre em nova aba, sem dar à página aberta acesso a esta (`noopener noreferrer`). A seta
 * é só visual; o leitor de tela ouve "(abre em nova aba)".
 */
export function LinkExterno({ href, children }: LinkExternoProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span> <span className="somente-leitor">(abre em nova aba)</span>
    </a>
  );
}
