import { useId, useState, type ReactNode } from 'react';
import styles from './form.module.css';

export interface FormBlockProps {
  numero: number;
  titulo: string;
  /** Rótulos do que ainda falta neste bloco; vazio = bloco completo (✓). */
  faltando: string[];
  /** Bloco começa aberto (padrão) ou recolhido. */
  abertoInicial?: boolean;
  children: ReactNode;
}

/** Bloco numerado e recolhível da bancada, com o estado ("✓" ou "falta: …") sempre à vista. */
export function FormBlock({
  numero,
  titulo,
  faltando,
  abertoInicial = true,
  children,
}: FormBlockProps) {
  const [aberto, setAberto] = useState(abertoInicial);
  const conteudoId = useId();
  const completo = faltando.length === 0;

  return (
    <section className={styles.bloco} aria-label={titulo}>
      <h2 className={styles.blocoTitulo}>
        <button
          type="button"
          className={styles.blocoCabecalho}
          aria-expanded={aberto}
          aria-controls={conteudoId}
          onClick={() => {
            setAberto((v) => !v);
          }}
        >
          <span className={styles.blocoNumero} aria-hidden="true">
            {numero}
          </span>
          <span className={styles.blocoNome}>{titulo}</span>
          {completo ? (
            <span className={styles.statusOk} role="img" aria-label="Completo">
              ✓
            </span>
          ) : (
            <span className={styles.statusFalta}>{`falta: ${faltando.join(', ')}`}</span>
          )}
          <span className={styles.seta} aria-hidden="true">
            {aberto ? '▾' : '▸'}
          </span>
        </button>
      </h2>
      <div id={conteudoId} className={styles.blocoConteudo} hidden={!aberto}>
        {children}
      </div>
    </section>
  );
}
