import { useId, useRef, useState } from 'react';
import { ATA_TYPES } from '../../ata-types/registry';
import {
  carregarExemplo,
  MENSAGEM_ERRO_EXEMPLO,
  type CarregadoresExemplo,
} from '../../exemplos/carregar';
import type { Exemplo } from '../../exemplos/tipos';
import { Modal } from '../../ui/Modal';
import styles from './exemplo.module.css';

export interface EscolherExemploProps {
  aberto: boolean;
  onFechar: () => void;
  carregadores: CarregadoresExemplo;
  /** O rascunho desta aba tem algo da pessoa que o exemplo vai substituir. */
  substituiRascunho: boolean;
  /** Há uma geração de IA em andamento, que o exemplo vai cancelar. */
  cancelaGeracao: boolean;
  /** O exemplo chegou (o seletor não troca nada sozinho: quem decide é a bancada). */
  onCarregado: (exemplo: Exemplo) => void;
}

/**
 * Seletor do "Ver exemplo": um botão por tipo de ata. Escolher carrega o exemplo sob demanda
 * (chunk próprio); fechar durante o carregamento o descarta. Falha → alerta com causa e ação, e o
 * rascunho fica como estava.
 */
export function EscolherExemplo({
  aberto,
  onFechar,
  carregadores,
  substituiRascunho,
  cancelaGeracao,
  onCarregado,
}: EscolherExemploProps) {
  const baseId = useId();
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  /** Só a última escolha vale: fechar ou escolher de novo descarta a carga anterior. */
  const cargaRef = useRef(0);

  const fechar = () => {
    cargaRef.current++;
    setCarregando(null);
    setErro(false);
    onFechar();
  };

  const escolher = async (tipoId: string) => {
    if (carregando !== null) return;
    const carga = ++cargaRef.current;
    setCarregando(tipoId);
    setErro(false);
    try {
      const exemplo = await carregarExemplo(tipoId, carregadores);
      if (carga !== cargaRef.current) return;
      setCarregando(null);
      onCarregado(exemplo);
    } catch {
      // `carregarExemplo` só lança `ErroExemplo`, com a mensagem do app.
      if (carga !== cargaRef.current) return;
      setCarregando(null);
      setErro(true);
    }
  };

  return (
    <Modal aberto={aberto} titulo="Ver um exemplo" onFechar={fechar}>
      <p>
        Um exemplo completo, com dados e pessoas fictícios e a ata já gerada. Nada é enviado para
        IA.
      </p>
      {substituiRascunho ? (
        <p className={styles.alerta}>
          O rascunho desta aba (dados, participantes, transcrição e ata gerada) será substituído
          pelo exemplo. A sua logo é mantida.
        </p>
      ) : null}
      {cancelaGeracao ? (
        <p className={styles.alerta}>A geração em andamento será cancelada.</p>
      ) : null}
      <ul className={styles.opcoes}>
        {Object.values(ATA_TYPES).map((tipo) => {
          const rotuloId = `${baseId}-${tipo.id}-rotulo`;
          const descricaoId = `${baseId}-${tipo.id}-descricao`;
          const carregandoId = `${baseId}-${tipo.id}-carregando`;
          const este = carregando === tipo.id;
          return (
            <li key={tipo.id}>
              <button
                type="button"
                className={styles.opcao}
                aria-labelledby={este ? `${rotuloId} ${carregandoId}` : rotuloId}
                aria-describedby={descricaoId}
                aria-busy={este ? true : undefined}
                disabled={carregando !== null && !este}
                onClick={() => {
                  void escolher(tipo.id);
                }}
              >
                <span id={rotuloId} className={styles.opcaoRotulo}>
                  {tipo.rotulo}
                </span>
                <span id={descricaoId} className={styles.opcaoDescricao}>
                  {tipo.descricao}
                </span>
                {este ? (
                  <span id={carregandoId} className={styles.opcaoCarregando}>
                    Carregando…
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {erro ? (
        <p role="alert" className={styles.erro}>
          <span aria-hidden="true">⚠ </span>
          {MENSAGEM_ERRO_EXEMPLO}
        </p>
      ) : null}
    </Modal>
  );
}
