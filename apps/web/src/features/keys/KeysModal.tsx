import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useKeys } from '../../ai/KeysContext';
import { ADAPTADORES } from '../../ai/providers';
import type { ProviderAdapter, ProviderId } from '../../ai/types';
import { ROTULO_PROVEDOR } from '../../config/models';
import { usePreferenciasStore } from '../../preferencias/PreferenciasContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { CartaoProvedor, type Direcao } from './CartaoProvedor';
import styles from './keys.module.css';

type Adaptadores = Record<ProviderId, ProviderAdapter>;

export interface KeysModalProps {
  aberto: boolean;
  onFechar: () => void;
  /** Substitui os adaptadores reais (testes). */
  adaptadores?: Adaptadores;
}

/** Modal "Chaves de IA": chave, modelo e ordem de preferência de cada provedor. */
export function KeysModal({ aberto, onFechar, adaptadores = ADAPTADORES }: KeysModalProps) {
  const keys = useKeys();
  const preferencias = usePreferenciasStore();
  const [confirmando, setConfirmando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  // Muda ao apagar tudo: remonta os cartões para zerarem o que a pessoa digitou.
  const [geracao, setGeracao] = useState(0);
  const setasRef = useRef(new Map<string, HTMLButtonElement>());
  const focoPendenteRef = useRef<string | null>(null);

  // Depois de reordenar, o React reposiciona os cartões; devolve o foco ao mesmo botão.
  useLayoutEffect(() => {
    const alvo = focoPendenteRef.current;
    if (alvo === null) return;
    focoPendenteRef.current = null;
    setasRef.current.get(alvo)?.focus();
  }, [keys.versao]);

  const ordem = keys.ordem();

  const mover = (provedor: ProviderId, direcao: Direcao): void => {
    const nova = [...ordem];
    const de = nova.indexOf(provedor);
    const para = direcao === 'cima' ? de - 1 : de + 1;
    if (de < 0 || para < 0 || para >= nova.length) return;
    nova.splice(de, 1);
    nova.splice(para, 0, provedor);
    focoPendenteRef.current = `${provedor}:${direcao}`;
    keys.reordenar(nova);
    preferencias.definir({ ordem: nova });
    setAnuncio(`Nova ordem de preferência: ${nova.map((p) => ROTULO_PROVEDOR[p]).join(', ')}.`);
  };

  const registrarSeta = (chave: string, el: HTMLButtonElement | null): void => {
    if (el) setasRef.current.set(chave, el);
    else setasRef.current.delete(chave);
  };

  const apagarTudo = (): void => {
    keys.apagarTudo();
    setGeracao((g) => g + 1);
    setAnuncio('');
    setConfirmando(false);
  };

  const avisoId = useId();

  return (
    <Modal
      aberto={aberto}
      titulo="Chaves de IA"
      onFechar={onFechar}
      acoes={
        <div className={styles.rodapeAcoes}>
          <Button
            variante="perigo"
            onClick={() => {
              setConfirmando(true);
            }}
          >
            Apagar todas as chaves
          </Button>
          <Button variante="primario" onClick={onFechar}>
            Concluir
          </Button>
        </div>
      }
    >
      <p className={styles.intro}>
        Suas chaves ficam só neste navegador e vão direto para o provedor escolhido. Nenhum servidor
        do Lavra recebe nada.
      </p>
      <p className={styles.intro}>
        Se um provedor falhar, o Lavra tenta o próximo, na ordem de prioridade abaixo.
      </p>

      <ol className={styles.lista} key={geracao}>
        {ordem.map((provedor, i) => (
          <CartaoProvedor
            key={provedor}
            provedor={provedor}
            posicao={i}
            total={ordem.length}
            adaptador={adaptadores[provedor]}
            onMover={mover}
            registrarSeta={registrarSeta}
          />
        ))}
      </ol>
      <p role="status" className="somente-leitor">
        {anuncio}
      </p>

      <div className={styles.lembrar}>
        <label className={styles.rotuloLembrar}>
          <input
            type="checkbox"
            checked={keys.lembrar()}
            aria-describedby={avisoId}
            onChange={(e) => {
              keys.definirLembrar(e.target.checked);
            }}
          />
          Lembrar neste navegador
        </label>
        <p id={avisoId} className={styles.avisoLembrar}>
          A chave ficará salva neste navegador. Qualquer extensão ou pessoa com acesso a ele poderá
          lê-la. Prefira uma chave com limite de gasto.
        </p>
        {keys.persistenciaIndisponivel() ? (
          <p role="alert" className={styles.avisoBloqueado}>
            <span aria-hidden="true">⚠ </span>
            Este navegador bloqueou o armazenamento; a chave fica só nesta aba.
          </p>
        ) : null}
      </div>

      <Modal
        aberto={confirmando}
        titulo="Apagar todas as chaves?"
        onFechar={() => {
          setConfirmando(false);
        }}
        acoes={
          <>
            <Button
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Cancelar
            </Button>
            <Button variante="perigo" onClick={apagarTudo}>
              Apagar tudo
            </Button>
          </>
        }
      >
        <p className={styles.confirmacao}>
          As chaves serão removidas desta página e do armazenamento do navegador. Para gerar uma
          ata, você precisará informá-las de novo.
        </p>
      </Modal>
    </Modal>
  );
}
