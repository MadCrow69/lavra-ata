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
}

export function MobileTabs({ ativa, onChange }: MobileTabsProps) {
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
          </button>
        );
      })}
    </div>
  );
}
