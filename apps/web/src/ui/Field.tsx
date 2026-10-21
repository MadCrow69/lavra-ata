import { useId, type ReactNode } from 'react';
import styles from './Field.module.css';

/** Atributos que o controle (input, select, textarea) recebe para ficar ligado ao rótulo e ao erro. */
export interface ControleProps {
  id: string;
  'aria-required'?: true;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}

export interface FieldProps {
  rotulo: string;
  obrigatorio?: boolean;
  /** Mensagem de erro exibida logo abaixo do campo; `undefined` = sem erro. */
  erro?: string | undefined;
  ajuda?: string | undefined;
  children: (controle: ControleProps) => ReactNode;
}

/**
 * Rótulo, ajuda e erro de um campo. O controle é recebido por função para que o
 * `<label>`, a ajuda e o erro fiquem sempre ligados a ele (clicar no rótulo foca o campo;
 * leitor de tela lê a ajuda e o erro junto).
 */
export function Field({ rotulo, obrigatorio = false, erro, ajuda, children }: FieldProps) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const descricao = [erro ? idErro : null, ajuda ? idAjuda : null].filter(Boolean).join(' ');

  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.rotulo}>
        {rotulo}
        {obrigatorio ? (
          <span className={styles.asterisco} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        ...(obrigatorio ? { 'aria-required': true as const } : {}),
        'aria-invalid': Boolean(erro),
        ...(descricao ? { 'aria-describedby': descricao } : {}),
      })}
      {erro ? (
        <p id={idErro} className={styles.erro}>
          <span aria-hidden="true">⚠ </span>
          {erro}
        </p>
      ) : null}
      {ajuda ? (
        <p id={idAjuda} className={styles.ajuda}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}
