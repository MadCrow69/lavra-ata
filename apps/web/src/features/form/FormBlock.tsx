import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { BlocoFormulario } from '../../ata-types/types';
import { EVENTO_REVELAR, type DetalheRevelar } from './focar-campo';
import styles from './form.module.css';

export interface FormBlockProps {
  numero: number;
  titulo: string;
  /** Bloco de `CampoFaltando` que esta seção mostra; permite à barra de geração achá-la e abri-la. */
  bloco?: BlocoFormulario;
  /** Rótulos do que ainda falta neste bloco; vazio = bloco completo (✓). */
  faltando: string[];
  /** Bloco começa aberto (padrão) ou recolhido. */
  abertoInicial?: boolean;
  children: ReactNode;
}

/** Bloco numerado e recolhível da bancada, com o estado ("✓" ou "falta: …") sempre à vista. */
export function FormBlock({
  numero,
  titulo,
  bloco,
  faltando,
  abertoInicial = true,
  children,
}: FormBlockProps) {
  const [aberto, setAberto] = useState(abertoInicial);
  const conteudoId = useId();
  const completo = faltando.length === 0;
  const conteudoRef = useRef<HTMLDivElement>(null);
  /** Controle a focar assim que o bloco terminar de abrir (pedido por `focarCampo`). */
  const focarDepoisRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const conteudo = conteudoRef.current;
    if (!conteudo) return;
    const revelar = (e: Event) => {
      const { alvo } = (e as CustomEvent<DetalheRevelar>).detail;
      focarDepoisRef.current = alvo;
      setAberto(true);
    };
    conteudo.addEventListener(EVENTO_REVELAR, revelar);
    return () => {
      conteudo.removeEventListener(EVENTO_REVELAR, revelar);
    };
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const alvo = focarDepoisRef.current;
    focarDepoisRef.current = null;
    alvo?.focus();
  }, [aberto]);

  return (
    <section className={styles.bloco} aria-label={titulo} data-bloco={bloco}>
      <h2 className={styles.blocoTitulo}>
        <button
          type="button"
          className={styles.blocoCabecalho}
          aria-expanded={aberto}
          aria-controls={conteudoId}
          onClick={() => {
            setAberto((v) => !v);
          }}
        >
          <span className={styles.blocoNumero} aria-hidden="true">
            {numero}
          </span>
          <span className={styles.blocoNome}>{titulo}</span>
          {completo ? (
            <span className={styles.statusOk} role="img" aria-label="Completo">
              ✓
            </span>
          ) : (
            <span className={styles.statusFalta}>{`falta: ${faltando.join(', ')}`}</span>
          )}
          <span className={styles.seta} aria-hidden="true">
            {aberto ? '▾' : '▸'}
          </span>
        </button>
      </h2>
      <div
        ref={conteudoRef}
        id={conteudoId}
        className={styles.blocoConteudo}
        hidden={!aberto}
        data-bloco-conteudo=""
      >
        {children}
      </div>
    </section>
  );
}
