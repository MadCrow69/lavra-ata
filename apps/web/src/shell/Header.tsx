import { useKeys } from '../ai/KeysContext';
import { ROTULO_CURTO } from '../config/models';
import { SITE } from '../config/site';
import styles from './AppShell.module.css';

export interface HeaderProps {
  onConfigurarChaves: () => void;
}

export function Header({ onConfigurarChaves }: HeaderProps) {
  const { cadeia } = useKeys();
  const ativos = cadeia().map((c) => ROTULO_CURTO[c.id]);

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
          {ativos.length === 0 ? (
            'Configurar chaves de IA'
          ) : (
            <>
              IA: {ativos.join(' → ')}
              <span className="somente-leitor"> — configurar chaves de IA</span>
            </>
          )}
        </button>
      </nav>
    </header>
  );
}
