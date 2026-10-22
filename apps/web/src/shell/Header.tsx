import { useState } from 'react';
import { useKeys } from '../ai/KeysContext';
import { ROTULO_CURTO } from '../config/models';
import { SITE } from '../config/site';
import { ComoVerificarModal, TITULO_COMO_VERIFICAR } from '../features/privacidade/ComoVerificar';
import { Button } from '../ui/Button';
import { LinkExterno } from '../ui/LinkExterno';
import styles from './AppShell.module.css';

export interface HeaderProps {
  onConfigurarChaves: () => void;
  /** Abre o exemplo pronto; sem ele o botão "Ver exemplo" não aparece. */
  onVerExemplo?: () => void;
}

export function Header({ onConfigurarChaves, onVerExemplo }: HeaderProps) {
  const { cadeia } = useKeys();
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);
  const ativos = cadeia().map((c) => ROTULO_CURTO[c.id]);

  return (
    <header className={styles.cabecalho}>
      <div className={styles.marca}>
        <h1 className={styles.nome}>{SITE.nome}</h1>
        <span className={styles.slogan}>{SITE.slogan}</span>
      </div>
      <nav className={styles.acoes} aria-label="Ações do cabeçalho">
        {onVerExemplo ? (
          <Button
            onClick={() => {
              onVerExemplo();
            }}
          >
            Ver exemplo
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setPrivacidadeAberta(true);
          }}
        >
          {TITULO_COMO_VERIFICAR}
        </Button>
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
        <LinkExterno href={SITE.repositorio}>GitHub</LinkExterno>
      </nav>
      <ComoVerificarModal
        aberto={privacidadeAberta}
        onFechar={() => {
          setPrivacidadeAberta(false);
        }}
      />
    </header>
  );
}
