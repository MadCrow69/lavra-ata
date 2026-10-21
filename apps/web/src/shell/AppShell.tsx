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
  /** Aba ativa em tela estreita, quando quem monta a casca a controla (ex.: ir à folha ao gerar). */
  aba?: AbaId;
  onTrocarAba?: (aba: AbaId) => void;
  /** Avisos por aba, mostrados como contador na própria aba (tela estreita). */
  avisos?: Partial<Record<AbaId, number>>;
}

export function AppShell({
  editar,
  documento,
  onConfigurarChaves,
  aba: abaControlada,
  onTrocarAba,
  avisos,
}: AppShellProps) {
  const largo = useLarguraLarga();
  const [abaInterna, setAbaInterna] = useState<AbaId>('editar');
  const aba = abaControlada ?? abaInterna;
  const trocarAba = (id: AbaId) => {
    setAbaInterna(id);
    onTrocarAba?.(id);
  };

  const paineis: Record<AbaId, ReactNode> = { editar, documento };

  return (
    <div className={styles.casca}>
      <Header onConfigurarChaves={onConfigurarChaves} />
      {!largo && <MobileTabs ativa={aba} onChange={trocarAba} {...(avisos ? { avisos } : {})} />}
      <main className={largo ? styles.duasColunas : styles.umaColuna}>
        {ABAS.map(({ id, rotulo }) => {
          // Em tela estreita o painel inativo fica oculto, mas montado: o que a
          // pessoa digitou em "Editar" não se perde ao olhar o "Documento". O painel de aba entra
          // na ordem do Tab (APG): o primeiro conteúdo dele pode não ser focável.
          const oculto = !largo && id !== aba;
          return (
            <section
              key={id}
              id={idDoPainel(id)}
              className={styles.painel}
              hidden={oculto}
              {...(largo
                ? { 'aria-label': rotulo }
                : { role: 'tabpanel', 'aria-labelledby': idDaAba(id), tabIndex: 0 })}
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
