import { useEffect, useId, useRef } from 'react';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import styles from './export.module.css';

const LINHAS_MAX = 14;

export interface CopiaManualProps {
  aberto: boolean;
  /** O texto que não coube na área de transferência automática. */
  texto: string;
  onFechar: () => void;
}

/**
 * Plano B de "Copiar tarefas por responsável" (navegador sem a API, permissão negada, página sem
 * foco): o texto já aparece selecionado, para Ctrl+C (ou Copiar, no celular). Nunca mostra o erro
 * da área de transferência.
 */
export function CopiaManual({ aberto, texto, onFechar }: CopiaManualProps) {
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const campoId = useId();
  const ajudaId = `${campoId}-ajuda`;

  // Depois do Modal, que foca o painel ao abrir (efeito do filho roda antes do deste pai).
  useEffect(() => {
    if (!aberto) return;
    campoRef.current?.focus();
    campoRef.current?.select();
  }, [aberto]);

  const linhas = Math.min(Math.max(texto.split('\n').length, 4), LINHAS_MAX);

  return (
    <Modal
      aberto={aberto}
      titulo="Copie as tarefas"
      onFechar={onFechar}
      acoes={<Button onClick={onFechar}>Fechar</Button>}
    >
      <p id={ajudaId}>
        Não foi possível copiar automaticamente. O texto já está selecionado: use Ctrl+C (ou Copiar,
        no celular).
      </p>
      <div className={styles.campoCopia}>
        <label htmlFor={campoId} className={styles.rotuloCopia}>
          Tarefas por responsável
        </label>
        <textarea
          ref={campoRef}
          id={campoId}
          className={styles.areaCopia}
          readOnly
          rows={linhas}
          value={texto}
          aria-describedby={ajudaId}
        />
      </div>
    </Modal>
  );
}
