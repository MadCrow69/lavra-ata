import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export interface ModalProps {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  /** Botões do rodapé (ex.: confirmar). O botão "Fechar" do cabeçalho existe sempre. */
  acoes?: ReactNode;
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Quantos modais seguram a rolagem da página (modais empilhados soltam só no último). */
let travas = 0;
let overflowAnterior = '';

function travarRolagem(): () => void {
  if (travas === 0) {
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  travas++;
  return () => {
    travas--;
    if (travas === 0) document.body.style.overflow = overflowAnterior;
  };
}

function focaveisDe(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
    (el) => !el.hasAttribute('hidden') && el.closest('[hidden]') === null,
  );
}

/**
 * Diálogo modal: foco preso dentro dele, Esc fecha, o foco volta a quem o abriu, a página
 * atrás não rola. Div com `role="dialog"` (e não `<dialog>`) para o comportamento ser o mesmo
 * em qualquer navegador e testável.
 */
export function Modal({ aberto, titulo, onFechar, children, acoes }: ModalProps) {
  const tituloId = useId();
  const painelRef = useRef<HTMLDivElement>(null);
  // O callback muda a cada render do pai; o efeito de abertura não pode reiniciar por causa dele.
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onFecharRef.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const soltarRolagem = travarRolagem();
    painelRef.current?.focus();

    // Foco que escapa (clique fora do alcance, leitor de tela) volta para o painel.
    const guardaFoco = (e: FocusEvent) => {
      const painel = painelRef.current;
      if (painel && e.target instanceof Node && !painel.contains(e.target)) painel.focus();
    };
    document.addEventListener('focusin', guardaFoco);

    return () => {
      document.removeEventListener('focusin', guardaFoco);
      soltarRolagem();
      if (origem?.isConnected) origem.focus();
    };
  }, [aberto]);

  if (!aberto) return null;

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onFecharRef.current();
      return;
    }
    if (e.key !== 'Tab') return;
    const painel = painelRef.current;
    if (!painel) return;
    const itens = focaveisDe(painel);
    const primeiro = itens[0];
    const ultimo = itens.at(-1);
    if (!primeiro || !ultimo) {
      e.preventDefault();
      painel.focus();
      return;
    }
    const ativo = document.activeElement;
    if (e.shiftKey && (ativo === primeiro || ativo === painel)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  return createPortal(
    <div
      className={styles.fundo}
      data-testid="modal-fundo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        ref={painelRef}
        className={styles.painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={aoTeclar}
      >
        <header className={styles.cabecalho}>
          <h2 id={tituloId} className={styles.titulo}>
            {titulo}
          </h2>
          <button type="button" className={styles.fechar} aria-label="Fechar" onClick={onFechar}>
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div className={styles.corpo}>{children}</div>
        {acoes ? <footer className={styles.rodape}>{acoes}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
