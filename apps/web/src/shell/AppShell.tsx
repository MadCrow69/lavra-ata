import { useState, type ReactNode } from 'react';
import styles from './AppShell.module.css';
import { Footer } from './Footer';
import { Header } from './Header';
import { ABAS, idDaAba, idDoPainel, MobileTabs, type AbaId } from './MobileTabs';
import { useLarguraLarga } from './useLarguraLarga';

export interface AppShellProps {
  editar: ReactNode;
  documento: ReactNode;
  onConfigurarChaves: () => void;
}

export function AppShell({ editar, documento, onConfigurarChaves }: AppShellProps) {
  const largo = useLarguraLarga();
  const [aba, setAba] = useState<AbaId>('editar');

  const paineis: Record<AbaId, ReactNode> = { editar, documento };

  return (
    <div className={styles.casca}>
      <Header onConfigurarChaves={onConfigurarChaves} />
      {!largo && <MobileTabs ativa={aba} onChange={setAba} />}
      <main className={largo ? styles.duasColunas : styles.umaColuna}>
        {ABAS.map(({ id, rotulo }) => {
          // Em tela estreita o painel inativo fica oculto, mas montado: o que a
          // pessoa digitou em "Editar" não se perde ao olhar o "Documento".
          const oculto = !largo && id !== aba;
          return (
            <section
              key={id}
              id={idDoPainel(id)}
              className={styles.painel}
              hidden={oculto}
              {...(largo
                ? { 'aria-label': rotulo }
                : { role: 'tabpanel', 'aria-labelledby': idDaAba(id) })}
            >
              {paineis[id]}
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
