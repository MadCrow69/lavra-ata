import { COMMIT_CURTO_TAMANHO, COMMIT_DESENVOLVIMENTO, SITE } from '../config/site';
import styles from './AppShell.module.css';

export interface FooterProps {
  /** SHA completo do commit; 'dev' fora do build do CI. */
  commit?: string;
}

export function Footer({ commit = SITE.commit }: FooterProps) {
  const emDesenvolvimento = commit === COMMIT_DESENVOLVIMENTO;

  return (
    <footer className={styles.rodape}>
      <ul className={styles.listaRodape}>
        <li>
          Feito por{' '}
          <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer">
            {SITE.autor}
          </a>
        </li>
        <li>
          <a href={SITE.repositorio} target="_blank" rel="noopener noreferrer">
            Código aberto (MIT)
          </a>
        </li>
        <li>
          {emDesenvolvimento ? (
            'versão de desenvolvimento'
          ) : (
            <a
              href={`${SITE.repositorio}/commit/${commit}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {`versão ${commit.slice(0, COMMIT_CURTO_TAMANHO)}`}
            </a>
          )}
        </li>
      </ul>
    </footer>
  );
}
