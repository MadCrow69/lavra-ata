import { memo, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  ROTULO_STATUS,
  STATUS_ENCAMINHAMENTO,
  type Encaminhamento,
  type StatusEncaminhamento,
} from '../../domain/draft';
import { useDraft } from '../../domain/DraftContext';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { Button } from '../../ui/Button';
import styles from './revisao.module.css';

interface Linha {
  /** Identidade da linha no editor (a posição muda ao remover). */
  id: number;
  acao: string;
  responsavel: string;
  prazo: string;
  status: StatusEncaminhamento;
}

export interface EncaminhamentosEditorProps {
  titulo: string;
  onFechar: () => void;
}

const AJUDA_PRAZO =
  'Prazo: escreva a data como AAAA-MM-DD (aparece na folha como dd/mm/aaaa) ou use um texto livre, como “na próxima reunião”. Para remover os encaminhamentos da ata, apague todas as linhas e salve.';

/** Mesmos encaminhamentos, campo a campo (a ordem das chaves do objeto não importa). */
function mesmosEncaminhamentos(a: Encaminhamento[], b: Encaminhamento[]): boolean {
  if (a.length !== b.length) return false;
  for (const [i, x] of a.entries()) {
    const y = b[i];
    if (y === undefined) return false;
    if (x.acao !== y.acao || x.responsavel !== y.responsavel) return false;
    if (x.prazo !== y.prazo || x.status !== y.status) return false;
  }
  return true;
}

function vazia(l: Linha): boolean {
  return l.acao.trim() === '' && l.responsavel.trim() === '' && l.prazo.trim() === '';
}

interface LinhaEncaminhamentoProps {
  linha: Linha;
  /** Posição exibida (1, 2, …): muda ao remover uma linha acima. */
  numero: number;
  /** Prefixo dos ids dos campos (estável por linha). */
  prefixo: string;
  invalida: boolean;
  ajudaPrazoId: string;
  onAlterar: (id: number, patch: Partial<Omit<Linha, 'id'>>) => void;
  onRemover: (id: number) => void;
}

/** Uma linha do editor. Memoizada: digitar numa linha não redesenha as outras (centenas de campos). */
const LinhaEncaminhamento = memo(function LinhaEncaminhamento({
  linha: l,
  numero,
  prefixo,
  invalida,
  ajudaPrazoId,
  onAlterar,
  onRemover,
}: LinhaEncaminhamentoProps) {
  const n = String(numero);
  return (
    <fieldset className={styles.linha} data-linha={l.id}>
      <legend className={styles.legenda}>{`Encaminhamento ${n}`}</legend>
      <div className={styles.celulaAcao}>
        <label htmlFor={`${prefixo}-acao`} className={styles.rotulo}>
          Ação
        </label>
        <input
          id={`${prefixo}-acao`}
          data-campo="acao"
          className={styles.campo}
          value={l.acao}
          aria-invalid={invalida}
          onChange={(e) => {
            onAlterar(l.id, { acao: e.target.value });
          }}
        />
      </div>
      <div>
        <label htmlFor={`${prefixo}-responsavel`} className={styles.rotulo}>
          Responsável
        </label>
        <input
          id={`${prefixo}-responsavel`}
          className={styles.campo}
          value={l.responsavel}
          onChange={(e) => {
            onAlterar(l.id, { responsavel: e.target.value });
          }}
        />
      </div>
      <div>
        <label htmlFor={`${prefixo}-prazo`} className={styles.rotulo}>
          Prazo
        </label>
        <input
          id={`${prefixo}-prazo`}
          className={styles.campo}
          value={l.prazo}
          placeholder="AAAA-MM-DD ou texto"
          aria-describedby={ajudaPrazoId}
          onChange={(e) => {
            onAlterar(l.id, { prazo: e.target.value });
          }}
        />
      </div>
      <div>
        <label htmlFor={`${prefixo}-status`} className={styles.rotulo}>
          Status
        </label>
        <select
          id={`${prefixo}-status`}
          className={styles.campo}
          value={l.status}
          onChange={(e) => {
            const status = STATUS_ENCAMINHAMENTO.find((s) => s === e.target.value);
            if (status) onAlterar(l.id, { status });
          }}
        >
          {STATUS_ENCAMINHAMENTO.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </div>
      <Button
        variante="perigo"
        aria-label={`Remover encaminhamento ${n}`}
        onClick={() => {
          onRemover(l.id);
        }}
      >
        Remover
      </Button>
    </fieldset>
  );
});

/**
 * Editor de linhas dos encaminhamentos (ação, responsável, prazo e status). O prazo é um campo de
 * texto: vale `AAAA-MM-DD` (vira `dd/mm/aaaa` na folha) ou texto livre, como "na próxima reunião"
 * (um `type="date"` não aceitaria o texto livre que a IA também produz). Linha totalmente vazia é
 * descartada; linha com dados e sem ação impede salvar. Salvar sem nenhuma linha remove os
 * encaminhamentos da ata. Enquanto a ata inteira é gerada, salvar fica parado.
 */
export function EncaminhamentosEditor({ titulo, onFechar }: EncaminhamentosEditorProps) {
  const { state, dispatch } = useDraft();
  const { operacao } = useOperacaoIA();
  const [atuais] = useState<Encaminhamento[]>(() => state.resultado?.encaminhamentos ?? []);
  const [linhas, setLinhas] = useState<Linha[]>(() => atuais.map((e, i) => ({ ...e, id: i })));
  const proximoIdRef = useRef(atuais.length);
  const [erro, setErro] = useState<string | null>(null);
  const [invalida, setInvalida] = useState<number | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const adicionarRef = useRef<HTMLButtonElement>(null);
  const novaLinhaRef = useRef<number | null>(null);
  const baseId = useId();
  const ajudaPrazoId = `${baseId}-prazo-ajuda`;
  const motivoId = `${baseId}-motivo`;
  const ataOcupada = operacao?.tipo === 'ata';

  const focarAcao = (id: number) => {
    raizRef.current
      ?.querySelector<HTMLElement>(`[data-linha="${String(id)}"] [data-campo="acao"]`)
      ?.focus();
  };

  // A linha recém-criada recebe o foco no campo Ação assim que existe no DOM.
  useEffect(() => {
    const id = novaLinhaRef.current;
    if (id === null) return;
    novaLinhaRef.current = null;
    focarAcao(id);
  }, [linhas]);

  // Estáveis entre renderizações: com 200 linhas, digitar numa só redesenha só ela (`memo`).
  const alterar = useCallback((id: number, patch: Partial<Omit<Linha, 'id'>>) => {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setErro(null);
    setInvalida(null);
  }, []);

  const adicionar = () => {
    const id = proximoIdRef.current++;
    novaLinhaRef.current = id;
    setLinhas((atual) => [
      ...atual,
      { id, acao: '', responsavel: '', prazo: '', status: 'pendente' },
    ]);
  };

  const remover = useCallback((id: number) => {
    setLinhas((atual) => atual.filter((l) => l.id !== id));
    setErro(null);
    setInvalida(null);
    adicionarRef.current?.focus();
  }, []);

  const salvar = () => {
    if (ataOcupada) return;
    const itens: Encaminhamento[] = [];
    for (const [i, l] of linhas.entries()) {
      if (vazia(l)) continue;
      const acao = l.acao.trim();
      if (acao === '') {
        setErro(`Informe a ação do encaminhamento ${String(i + 1)}, ou apague a linha.`);
        setInvalida(l.id);
        focarAcao(l.id);
        return;
      }
      itens.push({
        acao,
        responsavel: l.responsavel.trim(),
        prazo: l.prazo.trim(),
        status: l.status,
      });
    }
    // Sem mudança real não há o que marcar como "editado por você".
    if (!mesmosEncaminhamentos(itens, atuais)) {
      dispatch({
        type: 'substituirEncaminhamentos',
        itens,
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

  return (
    <div
      ref={raizRef}
      role="group"
      aria-label={`Editar seção ${titulo}`}
      className={styles.editor}
      onKeyDown={aoTeclar}
    >
      {linhas.map((l, i) => (
        <LinhaEncaminhamento
          key={l.id}
          linha={l}
          numero={i + 1}
          prefixo={`${baseId}-${String(l.id)}`}
          invalida={invalida === l.id}
          ajudaPrazoId={ajudaPrazoId}
          onAlterar={alterar}
          onRemover={remover}
        />
      ))}
      <p id={ajudaPrazoId} className={styles.ajuda}>
        {AJUDA_PRAZO}
      </p>
      {erro === null ? null : (
        <p role="alert" className={styles.erroCampo}>
          <span aria-hidden="true">⚠ </span>
          {erro}
        </p>
      )}
      {ataOcupada ? (
        <p id={motivoId} className={styles.ajuda}>
          {MOTIVO_IA_OCUPADA}
        </p>
      ) : null}
      <div className={styles.botoes}>
        <Button ref={adicionarRef} onClick={adicionar}>
          Adicionar encaminhamento
        </Button>
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
