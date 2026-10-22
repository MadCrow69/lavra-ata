import { COMMIT_CURTO_TAMANHO, COMMIT_DESENVOLVIMENTO, SITE, urlDoCommit } from '../config/site';
import { LinkExterno } from '../ui/LinkExterno';
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
          Feito por <LinkExterno href={SITE.linkedin}>{SITE.autor}</LinkExterno>
        </li>
        <li>
          <LinkExterno href={SITE.repositorio}>Código aberto (MIT)</LinkExterno>
        </li>
        <li>
          {emDesenvolvimento ? (
            'versão de desenvolvimento'
          ) : (
            <LinkExterno href={urlDoCommit(commit)}>
              {`versão ${commit.slice(0, COMMIT_CURTO_TAMANHO)}`}
            </LinkExterno>
          )}
        </li>
      </ul>
    </footer>
  );
}
