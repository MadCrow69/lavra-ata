import { useRef, type KeyboardEvent } from 'react';
import styles from './AppShell.module.css';

export type AbaId = 'editar' | 'documento';

export const ABAS: readonly { id: AbaId; rotulo: string }[] = [
  { id: 'editar', rotulo: 'Editar' },
  { id: 'documento', rotulo: 'Documento' },
];

export const idDaAba = (id: AbaId) => `aba-${id}`;
export const idDoPainel = (id: AbaId) => `painel-${id}`;

export interface MobileTabsProps {
  ativa: AbaId;
  onChange: (id: AbaId) => void;
  /** Avisos por aba (ex.: avisos da ata na aba Documento), para não passarem despercebidos. */
  avisos?: Partial<Record<AbaId, number>>;
}

export function MobileTabs({ ativa, onChange, avisos = {} }: MobileTabsProps) {
  const abasRef = useRef<Partial<Record<AbaId, HTMLButtonElement | null>>>({});

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = ABAS.length - 1;
    let destino: number;
    if (evento.key === 'ArrowRight') destino = indice === ultimo ? 0 : indice + 1;
    else if (evento.key === 'ArrowLeft') destino = indice === 0 ? ultimo : indice - 1;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = ultimo;
    else return;

    evento.preventDefault();
    const alvo = ABAS[destino];
    if (!alvo) return;
    onChange(alvo.id);
    abasRef.current[alvo.id]?.focus();
  }

  return (
    <div role="tablist" aria-label="Seções do app" className={styles.abas}>
      {ABAS.map(({ id, rotulo }, indice) => {
        const selecionada = id === ativa;
        const quantos = avisos[id] ?? 0;
        return (
          <button
            key={id}
            ref={(elemento) => {
              abasRef.current[id] = elemento;
            }}
            type="button"
            role="tab"
            id={idDaAba(id)}
            aria-selected={selecionada}
            aria-controls={idDoPainel(id)}
            tabIndex={selecionada ? 0 : -1}
            className={styles.aba}
            onClick={() => {
              onChange(id);
            }}
            onKeyDown={(evento) => {
              aoTeclar(evento, indice);
            }}
          >
            {rotulo}
            {quantos > 0 ? (
              <span className={styles.indicador}>
                <span aria-hidden="true">{`⚠ ${String(quantos)}`}</span>
                <span className="somente-leitor">{`, ${String(quantos)} ${quantos === 1 ? 'aviso' : 'avisos'}`}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
