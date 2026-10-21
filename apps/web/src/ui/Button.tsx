import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variante?: 'primario' | 'secundario' | 'perigo';
}

/** Botão com alvo mínimo de 44 px. `type="button"` por padrão, para nunca enviar formulário sem querer. */
export function Button({ variante = 'secundario', type = 'button', ...resto }: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.botao, styles[variante]].filter(Boolean).join(' ')}
      {...resto}
    />
  );
}
