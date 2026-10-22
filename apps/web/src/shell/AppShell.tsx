import { useState, type ReactNode } from 'react';
import styles from './AppShell.module.css';
import { Footer } from './Footer';
import { Header } from './Header';
import { ABAS, idDaAba, idDoPainel, MobileTabs, type AbaId } from './MobileTabs';
import { useLarguraLarga } from './useLarguraLarga';

/**
 * Aba ativa em tela estreita: controlada por quem monta a casca (ex.: ir à folha ao gerar), com
 * `aba` e `onTrocarAba` juntos, ou interna à casca, sem nenhum dos dois.
 */
type ControleDaAba =
  { aba: AbaId; onTrocarAba: (aba: AbaId) => void } | { aba?: undefined; onTrocarAba?: undefined };

export type AppShellProps = ControleDaAba & {
  editar: ReactNode;
  documento: ReactNode;
  onConfigurarChaves: () => void;
  /** Abre o seletor de exemplos; sem ele o cabeçalho não mostra "Ver exemplo". */
  onVerExemplo?: () => void;
  /** Aviso da página toda (ex.: modo exemplo), logo abaixo do cabeçalho e visível nas duas abas. */
  aviso?: ReactNode;
  /** Avisos por aba, mostrados como contador na própria aba (tela estreita). */
  avisos?: Partial<Record<AbaId, number>>;
};

/**
 * Painéis de aba que entram na ordem do Tab (APG: quando o primeiro conteúdo não é focável). O
 * Documento abre com texto (avisos, a folha); o Editar abre com controles ("Nova ata", campos).
 */
const PAINEL_FOCAVEL: Record<AbaId, boolean> = { editar: false, documento: true };

export function AppShell({
  editar,
  documento,
  onConfigurarChaves,
  onVerExemplo,
  aviso,
  aba: abaControlada,
  onTrocarAba,
  avisos,
}: AppShellProps) {
  const largo = useLarguraLarga();
  const [abaInterna, setAbaInterna] = useState<AbaId>('editar');
  const aba = abaControlada ?? abaInterna;
  const trocarAba = onTrocarAba ?? setAbaInterna;

  const paineis: Record<AbaId, ReactNode> = { editar, documento };

  return (
    <div className={styles.casca}>
      <Header onConfigurarChaves={onConfigurarChaves} {...(onVerExemplo ? { onVerExemplo } : {})} />
      {aviso}
      {!largo && <MobileTabs ativa={aba} onChange={trocarAba} {...(avisos ? { avisos } : {})} />}
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
                : {
                    role: 'tabpanel',
                    'aria-labelledby': idDaAba(id),
                    ...(PAINEL_FOCAVEL[id] ? { tabIndex: 0 } : {}),
                  })}
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
