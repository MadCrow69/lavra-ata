import { useState } from 'react';
import { useOperacaoIA } from '../../generation/OperacaoIA';
import { Button } from '../../ui/Button';
import styles from './workbench.module.css';

/**
 * No celular, a geração da ata começa na aba Editar, mas a pessoa pode estar olhando a aba
 * Documento: aqui ela vê o progresso e pode cancelar, em vez de encarar uma folha que não muda.
 * Cancelar por aqui é cancelar pela pessoa (a barra de geração registra "Geração cancelada").
 */
export function GeracaoNoDocumento() {
  const { operacao, cancelarAtual } = useOperacaoIA();
  const gerando = operacao?.tipo === 'ata';
  const [cancelou, setCancelou] = useState(false);
  // Uma nova geração apaga o aviso de cancelamento da anterior.
  const [gerandoAntes, setGerandoAntes] = useState(gerando);
  if (gerando !== gerandoAntes) {
    setGerandoAntes(gerando);
    if (gerando) setCancelou(false);
  }

  return (
    <div className={styles.geracao} aria-live="polite">
      {gerando ? (
        <>
          <progress className={styles.progresso} aria-label="Gerando a ata" />
          <p className={styles.geracaoTexto}>
            Gerando a ata — pode levar até 2 minutos. A folha muda quando terminar.
          </p>
          <Button
            aria-label="Cancelar geração da ata"
            onClick={() => {
              setCancelou(true);
              cancelarAtual();
            }}
          >
            Cancelar
          </Button>
        </>
      ) : cancelou ? (
        <p className={styles.geracaoTexto}>Geração cancelada. A ata não foi alterada.</p>
      ) : null}
    </div>
  );
}
