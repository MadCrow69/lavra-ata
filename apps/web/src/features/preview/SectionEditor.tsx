import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDraft } from '../../domain/DraftContext';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { blocosParaTexto } from '../../generation/prompt';
import { textoParaBlocos } from '../../generation/texto-blocos';
import { Button } from '../../ui/Button';
import styles from './revisao.module.css';

const LINHAS_MIN = 5;
const LINHAS_MAX = 20;

const AJUDA_FORMATO =
  'Separe os parágrafos com uma linha em branco. Para fazer uma lista, comece cada item com “- ” (hífen e espaço). Para um parágrafo depois da lista, deixe uma linha em branco. Para remover a seção da ata, apague todo o texto e salve.';

export interface SectionEditorProps {
  /** Chave da seção em `resultado.secoes` (nunca `encaminhamentos`: tem editor próprio). */
  chave: string;
  titulo: string;
  onFechar: () => void;
}

/**
 * Edição manual do texto de uma seção. Parágrafos são separados por linha em branco e itens de
 * lista começam com "- " (o mesmo formato que a IA recebe ao regerar). Salvar grava a seção como
 * editada à mão (texto vazio = remover a seção da ata); Esc e Cancelar descartam. Enquanto a ata
 * inteira é gerada, salvar fica parado: o resultado vai substituir tudo.
 */
export function SectionEditor({ chave, titulo, onFechar }: SectionEditorProps) {
  const { state, dispatch } = useDraft();
  const { operacao } = useOperacaoIA();
  const [inicial] = useState(() => blocosParaTexto(state.resultado?.secoes[chave] ?? []));
  const [texto, setTexto] = useState(inicial);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();
  const campoId = `${baseId}-campo`;
  const ajudaId = `${baseId}-ajuda`;
  const motivoId = `${baseId}-motivo`;
  const ataOcupada = operacao?.tipo === 'ata';

  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  const salvar = () => {
    if (ataOcupada) return;
    const blocos = textoParaBlocos(texto);
    // Sem mudança real não há o que marcar como "editado por você".
    if (blocosParaTexto(blocos) !== inicial) {
      dispatch({
        type: 'substituirSecao',
        chave,
        blocos,
        avisos: [],
        atribuicao: null,
        mapa: null,
      });
    }
    onFechar();
  };

  const aoTeclar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onFechar();
  };

  const linhas = Math.min(Math.max(texto.split('\n').length + 1, LINHAS_MIN), LINHAS_MAX);

  return (
    <div
      role="group"
      aria-label={`Editar seção ${titulo}`}
      className={styles.editor}
      onKeyDown={aoTeclar}
    >
      <label htmlFor={campoId} className={styles.rotulo}>
        {`Texto da seção ${titulo}`}
      </label>
      <textarea
        id={campoId}
        ref={campoRef}
        className={styles.campo}
        rows={linhas}
        value={texto}
        aria-describedby={ajudaId}
        onChange={(e) => {
          setTexto(e.target.value);
        }}
      />
      <p id={ajudaId} className={styles.ajuda}>
        {AJUDA_FORMATO}
      </p>
      {ataOcupada ? (
        <p id={motivoId} className={styles.ajuda}>
          {MOTIVO_IA_OCUPADA}
        </p>
      ) : null}
      <div className={styles.botoes}>
        <Button
          variante="primario"
          disabled={ataOcupada}
          aria-describedby={ataOcupada ? motivoId : undefined}
          onClick={salvar}
        >
          Salvar
        </Button>
        <Button onClick={onFechar}>Cancelar</Button>
      </div>
    </div>
  );
}
