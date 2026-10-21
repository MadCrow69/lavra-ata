import { useEffect, useId, useRef, useState } from 'react';
import type { DocumentModel } from '../../document/model';
import { useDraft } from '../../domain/DraftContext';
import { baixarArquivo } from '../../export/baixar';
import {
  CARREGADORES_PADRAO,
  ErroExportacao,
  gerarArquivo,
  type CarregadoresExportacao,
} from '../../export/exportar';
import { nomeDoArquivo, ROTULO_FORMATO, type FormatoExportacao } from '../../export/nome-arquivo';
import { caracteresSemFonte } from '../../export/pdf/cobertura';
import { mensagemTarefasCopiadas, textoDasTarefas } from '../../export/tarefas';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { plural } from '../../ui/plural';
import { useToast } from '../../ui/Toast';
import { CopiaManual } from './CopiaManual';
import styles from './export.module.css';

const MOTIVO_SEM_ATA = 'Gere a ata para baixar o PDF ou o DOCX.';
const MOTIVO_SEM_ENCAMINHAMENTOS = 'A ata não tem encaminhamentos para copiar.';

export interface ExportBarProps {
  /** O documento como a folha o mostra (com a logo): o arquivo sai deste modelo. */
  modelo: DocumentModel;
  /** Quantas lacunas `[PREENCHER]` o documento tem. */
  lacunas: number;
  /** Leva a pessoa à primeira lacuna da folha. */
  onIrParaLacuna: () => void;
  /**
   * Editores de seção abertos na folha. O texto digitado neles e ainda não salvo NÃO está no
   * modelo, então não entra no arquivo: se houver algum aberto, o modal de confirmação avisa.
   */
  editoresAbertos?: number;
  /** Substitui os geradores reais (testes); o padrão os carrega sob demanda. */
  carregadores?: CarregadoresExportacao;
}

interface AvisosAntesDeBaixar {
  lacunas: number;
  caracteres: string[];
  editoresAbertos: number;
}

/** O que o modal de confirmação tem a dizer antes de baixar `formato`. */
function avisosAntesDeBaixar(
  formato: FormatoExportacao,
  modelo: DocumentModel,
  lacunas: number,
  editoresAbertos: number,
): AvisosAntesDeBaixar {
  return {
    lacunas,
    // Só o PDF tem fonte limitada; o DOCX deixa o Word escolher a fonte de cada caractere.
    caracteres: formato === 'pdf' ? caracteresSemFonte(modelo) : [],
    editoresAbertos,
  };
}

function precisaConfirmar(a: AvisosAntesDeBaixar): boolean {
  return a.lacunas > 0 || a.caracteres.length > 0 || a.editoresAbertos > 0;
}

function tituloDoAviso(a: AvisosAntesDeBaixar): string {
  if (a.lacunas > 0) return 'A ata ainda tem campos para preencher';
  if (a.caracteres.length > 0) return 'Alguns caracteres não cabem no PDF';
  return 'Há uma seção aberta para edição';
}

function textoLacunas(n: number): string {
  const campos = plural(n, 'campo marcado', 'campos marcados');
  const vao = plural(n, 'vai sair', 'vão sair');
  const como = plural(n, 'como está', 'como estão');
  return `${String(n)} ${campos} com [PREENCHER] ${vao} no documento ${como}.`;
}

function textoEditores(n: number): string {
  return n === 1
    ? 'Há 1 editor de seção aberto. O texto que ainda não foi salvo nele não entra no arquivo.'
    : `Há ${String(n)} editores de seção abertos. O texto que ainda não foi salvo neles não entra no arquivo.`;
}

/**
 * Barra de exportação da folha: "Baixar PDF", "Baixar DOCX" e "Copiar tarefas por responsável".
 *
 * Mapa de uso: entrada = coluna Documento (no celular, a aba "Documento"), acima da folha. Sem ata
 * gerada ou com a IA trabalhando, os botões ficam parados com o motivo à vista. O arquivo sai do
 * modelo do momento do clique, que é o que está salvo no rascunho: texto digitado num editor de
 * seção aberto e não salvo não entra (o modal avisa). Um clique = um arquivo. Se a folha for
 * reiniciada ("Nova ata") antes de o arquivo ficar pronto, ele é descartado.
 */
export function ExportBar({
  modelo,
  lacunas,
  onIrParaLacuna,
  editoresAbertos = 0,
  carregadores = CARREGADORES_PADRAO,
}: ExportBarProps) {
  const { state } = useDraft();
  const { operacao } = useOperacaoIA();
  const { mostrar } = useToast();
  const { tipoId, dados, resultado } = state;

  const [exportando, setExportando] = useState<FormatoExportacao | null>(null);
  const [confirmando, setConfirmando] = useState<FormatoExportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [textoManual, setTextoManual] = useState<string | null>(null);
  // A recusa do segundo clique não pode esperar o próximo render.
  const emCursoRef = useRef(false);
  const vivoRef = useRef(true);
  const irAposFecharRef = useRef(false);
  const motivoBaixarId = useId();
  const motivoCopiarId = useId();

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
    };
  }, []);

  // "Ir até o primeiro": a lacuna só recebe o foco DEPOIS de o Modal fechar, porque ele devolve o
  // foco ao botão que o abriu e, antes disso, tomaria o foco da lacuna de volta.
  useEffect(() => {
    if (confirmando !== null || !irAposFecharRef.current) return;
    irAposFecharRef.current = false;
    onIrParaLacuna();
  }, [confirmando, onIrParaLacuna]);

  const iaOcupada = operacao !== null;
  const semAta = resultado === null;
  const semEncaminhamentos = (resultado?.encaminhamentos.length ?? 0) === 0;
  const baixarParado = iaOcupada || semAta;
  const copiarParado = iaOcupada || semEncaminhamentos;
  const motivoBaixar = iaOcupada ? MOTIVO_IA_OCUPADA : semAta ? MOTIVO_SEM_ATA : null;
  const motivoCopiar = iaOcupada
    ? MOTIVO_IA_OCUPADA
    : semEncaminhamentos
      ? MOTIVO_SEM_ENCAMINHAMENTOS
      : null;
  // Mesmo motivo nos dois grupos (IA ocupada): uma frase só, ligada aos três botões.
  const motivoUnico = motivoBaixar !== null && motivoBaixar === motivoCopiar;

  async function exportar(formato: FormatoExportacao) {
    if (emCursoRef.current) return;
    emCursoRef.current = true;
    // O arquivo é do momento do clique, não do que a folha virar enquanto ele é gerado.
    const modeloDoClique = modelo;
    const nome = nomeDoArquivo(tipoId, dados.data, formato);
    setErro(null);
    setExportando(formato);
    try {
      const arquivo = await gerarArquivo(formato, modeloDoClique, carregadores);
      if (!vivoRef.current) return;
      try {
        baixarArquivo(arquivo, nome);
      } catch {
        throw new ErroExportacao('geracao', formato);
      }
      mostrar({ titulo: `${ROTULO_FORMATO[formato]} baixado`, detalhes: [nome] });
    } catch (e) {
      // Texto de biblioteca nunca chega à tela: só a mensagem fixa de `ErroExportacao`.
      if (vivoRef.current) {
        setErro((e instanceof ErroExportacao ? e : new ErroExportacao('geracao', formato)).message);
      }
    } finally {
      emCursoRef.current = false;
      if (vivoRef.current) setExportando(null);
    }
  }

  function pedir(formato: FormatoExportacao) {
    if (emCursoRef.current || baixarParado) return;
    if (precisaConfirmar(avisosAntesDeBaixar(formato, modelo, lacunas, editoresAbertos))) {
      setConfirmando(formato);
      return;
    }
    void exportar(formato);
  }

  async function copiar() {
    if (copiarParado || resultado === null) return;
    const { texto, pessoas, semResponsavel } = textoDasTarefas(
      modelo.titulo,
      dados.data,
      resultado.encaminhamentos,
    );
    try {
      const area = (navigator as Partial<Navigator>).clipboard;
      if (area === undefined) throw new Error('sem área de transferência');
      await area.writeText(texto);
      if (vivoRef.current)
        mostrar({ titulo: mensagemTarefasCopiadas({ pessoas, semResponsavel }) });
    } catch {
      // Nunca mostra nem registra o erro: pode trazer dados da ata.
      if (vivoRef.current) setTextoManual(texto);
    }
  }

  const avisos =
    confirmando === null
      ? null
      : avisosAntesDeBaixar(confirmando, modelo, lacunas, editoresAbertos);
  const ocupadoPdf = exportando === 'pdf';
  const ocupadoDocx = exportando === 'docx';

  return (
    <div className={styles.barra} role="group" aria-label="Exportar a ata">
      <div className={styles.acoes}>
        {/* O botão clicado fica `aria-disabled` (e não `disabled`) para não perder o foco. */}
        <Button
          variante="primario"
          disabled={baixarParado || (exportando !== null && !ocupadoPdf)}
          aria-disabled={ocupadoPdf ? true : undefined}
          aria-busy={ocupadoPdf}
          aria-describedby={motivoBaixar === null ? undefined : motivoBaixarId}
          onClick={() => {
            pedir('pdf');
          }}
        >
          {ocupadoPdf ? 'Gerando PDF…' : 'Baixar PDF'}
        </Button>
        <Button
          variante="primario"
          disabled={baixarParado || (exportando !== null && !ocupadoDocx)}
          aria-disabled={ocupadoDocx ? true : undefined}
          aria-busy={ocupadoDocx}
          aria-describedby={motivoBaixar === null ? undefined : motivoBaixarId}
          onClick={() => {
            pedir('docx');
          }}
        >
          {ocupadoDocx ? 'Gerando DOCX…' : 'Baixar DOCX'}
        </Button>
        <Button
          disabled={copiarParado}
          aria-describedby={
            motivoCopiar === null ? undefined : motivoUnico ? motivoBaixarId : motivoCopiarId
          }
          onClick={() => {
            void copiar();
          }}
        >
          Copiar tarefas por responsável
        </Button>
      </div>
      {motivoBaixar !== null || motivoCopiar !== null ? (
        <div className={styles.motivos}>
          {motivoBaixar === null ? null : <p id={motivoBaixarId}>{motivoBaixar}</p>}
          {motivoCopiar === null || motivoUnico ? null : <p id={motivoCopiarId}>{motivoCopiar}</p>}
        </div>
      ) : null}
      {erro === null ? null : (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
      <Modal
        aberto={confirmando !== null}
        titulo={avisos === null ? '' : tituloDoAviso(avisos)}
        onFechar={() => {
          setConfirmando(null);
        }}
        acoes={
          <>
            {avisos !== null && avisos.lacunas > 0 ? (
              <Button
                onClick={() => {
                  irAposFecharRef.current = true;
                  setConfirmando(null);
                }}
              >
                Ir até o primeiro
              </Button>
            ) : null}
            <Button
              variante="primario"
              onClick={() => {
                const formato = confirmando;
                setConfirmando(null);
                if (formato !== null) void exportar(formato);
              }}
            >
              Baixar mesmo assim
            </Button>
          </>
        }
      >
        {avisos === null ? null : (
          <div className={styles.avisos}>
            {avisos.lacunas > 0 ? (
              <p className={styles.aviso}>{textoLacunas(avisos.lacunas)}</p>
            ) : null}
            {avisos.caracteres.length > 0 ? (
              <p className={styles.aviso}>
                {`Estes caracteres não existem na fonte do PDF e vão aparecer como um quadrado: ${avisos.caracteres.join(' ')}. O DOCX mostra todos.`}
              </p>
            ) : null}
            {avisos.editoresAbertos > 0 ? (
              <p className={styles.aviso}>{textoEditores(avisos.editoresAbertos)}</p>
            ) : null}
          </div>
        )}
      </Modal>
      <CopiaManual
        aberto={textoManual !== null}
        texto={textoManual ?? ''}
        onFechar={() => {
          setTextoManual(null);
        }}
      />
    </div>
  );
}
