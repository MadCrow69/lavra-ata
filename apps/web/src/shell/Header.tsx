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
  /**
   * Nada na bancada (rascunho vazio). Sem chave e sem nada a perder, quem chega é visitante: "Ver
   * exemplo" vira a ação principal do cabeçalho e "Configurar chaves de IA" passa a secundária.
   */
  rascunhoVazio?: boolean;
}

export function Header({ onConfigurarChaves, onVerExemplo, rascunhoVazio = false }: HeaderProps) {
  const { cadeia } = useKeys();
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);
  const ativos = cadeia().map((c) => ROTULO_CURTO[c.id]);
  const exemploEmDestaque = onVerExemplo !== undefined && ativos.length === 0 && rascunhoVazio;

  return (
    <header className={styles.cabecalho}>
      <div className={styles.marca}>
        <h1 className={styles.nome}>{SITE.nome}</h1>
        <span className={styles.slogan}>{SITE.slogan}</span>
      </div>
      <nav className={styles.acoes} aria-label="Ações do cabeçalho">
        {onVerExemplo ? (
          <Button
            variante={exemploEmDestaque ? 'primario' : 'secundario'}
            onClick={() => {
              onVerExemplo();
            }}
          >
            Ver exemplo
          </Button>
        ) : null}
        {/* No celular, privacidade e GitHub viram links menores (ver AppShell.module.css). */}
        <span className={styles.acaoMenor}>
          <Button
            onClick={() => {
              setPrivacidadeAberta(true);
            }}
          >
            {TITULO_COMO_VERIFICAR}
          </Button>
        </span>
        <Button
          variante={exemploEmDestaque ? 'secundario' : 'primario'}
          onClick={onConfigurarChaves}
        >
          {ativos.length === 0 ? (
            'Configurar chaves de IA'
          ) : (
            <>
              IA: {ativos.join(' → ')}
              <span className="somente-leitor"> — configurar chaves de IA</span>
            </>
          )}
        </Button>
        <span className={styles.acaoMenor}>
          <LinkExterno href={SITE.repositorio}>GitHub</LinkExterno>
        </span>
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
