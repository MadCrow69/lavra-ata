import { SITE } from '../config/site';
import styles from './AppShell.module.css';

export interface HeaderProps {
  onConfigurarChaves: () => void;
}

export function Header({ onConfigurarChaves }: HeaderProps) {
  return (
    <header className={styles.cabecalho}>
      <div className={styles.marca}>
        <span className={styles.nome}>{SITE.nome}</span>
        <span className={styles.slogan}>{SITE.slogan}</span>
      </div>
      <nav className={styles.acoes} aria-label="Ações do cabeçalho">
        <a href={SITE.repositorio} target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
        <button type="button" className={styles.botaoPrimario} onClick={onConfigurarChaves}>
          Configurar chaves de IA
        </button>
      </nav>
    </header>
  );
}
