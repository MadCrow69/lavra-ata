import { useKeys } from '../ai/KeysContext';
import { ROTULO_CURTO } from '../config/models';
import { SITE } from '../config/site';
import { LinkExterno } from '../ui/LinkExterno';
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
        <h1 className={styles.nome}>{SITE.nome}</h1>
        <span className={styles.slogan}>{SITE.slogan}</span>
      </div>
      <nav className={styles.acoes} aria-label="Ações do cabeçalho">
        <LinkExterno href={SITE.repositorio}>GitHub</LinkExterno>
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
