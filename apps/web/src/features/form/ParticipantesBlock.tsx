import { memo, useId, useMemo, useRef, useState, type Dispatch, type SubmitEvent } from 'react';
import {
  camposFaltando,
  colunasDeParticipantes,
  ehObrigatorio,
  problemaDoCampo,
  rotuloDaOpcao,
  rotuloDoCampo,
  type ColunaParticipante,
  type ProblemaCampo,
} from '../../ata-types/registry';
import { textoLimpo } from '../../ata-types/texto-modelo';
import type { AtaTypeDefinition, CampoDef, RotuloPessoa } from '../../ata-types/types';
import { PARTICIPANTES_ATE_ROLAGEM } from '../../config/limits';
import { ESPERA_ANUNCIO_RESUMO_MS, LARGURA_TELA_ESTREITA_REM } from '../../config/ui';
import { useDraft } from '../../domain/DraftContext';
import { calcularAdicao } from '../../domain/participantes';
import {
  PRESENCAS,
  ROTULO_PRESENCA,
  type DraftAction,
  type Participante,
} from '../../domain/draft';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { plural } from '../../ui/plural';
import { useConsultaMidia } from '../../ui/useConsultaMidia';
import { marcarCampo } from './focar-campo';
import { FormBlock } from './FormBlock';
import {
  analisarLista,
  contarRepetidos,
  descreverAdicao,
  descreverPreenchimento,
  normalizarBusca,
  type LinhaParticipante,
} from './lista-participantes';
import { useTextoAdiado } from './useTextoAdiado';
import styles from './form.module.css';

const CONSULTA_TELA_ESTREITA = `(max-width: ${String(LARGURA_TELA_ESTREITA_REM)}rem)`;

interface LinhaProps {
  participante: Participante;
  posicao: number;
  colunas: ColunaParticipante[];
  /** Os dados da reunião decidem a obrigatoriedade e a validade dos extras (ver `mesmaLinha`). */
  dados: Record<string, string>;
  /** Prefixo dos ids das descrições compartilhadas por coluna (uma linha de resumo por coluna). */
  vaziosId: string;
  /** Substantivo do tipo ("sócio", "condômino"…) nos rótulos da linha. */
  pessoa: RotuloPessoa;
  dispatch: Dispatch<DraftAction>;
}

function problemasDaLinha({ participante, colunas, dados }: LinhaProps): (ProblemaCampo | null)[] {
  return colunas.map((c) =>
    c.campo ? problemaDoCampo(c.campo, participante.extras[c.id], dados) : null,
  );
}

function mesmoProblema(a: ProblemaCampo | null, b: ProblemaCampo | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.tipo === 'vazio' || b.tipo === 'vazio') return a.tipo === b.tipo;
  return a.mensagem === b.mensagem;
}

/** Id da linha de resumo da coluna: é a descrição de toda célula vazia (obrigatória) dela. */
function idDoResumoVazios(vaziosId: string, colunaId: string): string {
  return `${vaziosId}-${colunaId}`;
}

function mesmasColunas(a: ColunaParticipante[], b: ColunaParticipante[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((c, i) => c.id === b[i]?.id && c.rotulo === b[i].rotulo && c.campo === b[i].campo))
  );
}

/**
 * Uma linha só redesenha se mudou algo que ela mostra. `dados` muda a cada tecla de outro bloco:
 * ele só conta pelo que decide aqui (colunas visíveis e problemas dos extras); senão as
 * centenas de linhas redesenhariam a cada tecla digitada em "Dados da reunião".
 */
function mesmaLinha(a: LinhaProps, b: LinhaProps): boolean {
  if (
    a.participante !== b.participante ||
    a.posicao !== b.posicao ||
    a.dispatch !== b.dispatch ||
    a.vaziosId !== b.vaziosId ||
    a.pessoa !== b.pessoa ||
    !mesmasColunas(a.colunas, b.colunas)
  ) {
    return false;
  }
  if (a.dados === b.dados) return true;
  const antes = problemasDaLinha(a);
  const depois = problemasDaLinha(b);
  return antes.every((problema, i) => mesmoProblema(problema, depois[i] ?? null));
}

interface CampoExtraProps {
  campo: CampoDef;
  valor: string;
  rotulo: string;
  problema: ProblemaCampo | null;
  /** Id da mensagem desta célula (só valor inválido) e o da descrição compartilhada (vazio). */
  erroId: string;
  vazioId: string;
  onChange: (valor: string) => void;
}

function CampoExtra({
  campo,
  valor,
  rotulo,
  problema,
  erroId,
  vazioId,
  onChange,
}: CampoExtraProps) {
  // Vazio é igual em toda a coluna: marca a célula e aponta para UMA descrição compartilhada.
  // Só o valor inválido é específico da linha e leva texto próprio.
  const acessibilidade = {
    'aria-label': rotulo,
    'aria-invalid': problema !== null,
    'aria-describedby':
      problema === null ? undefined : problema.tipo === 'vazio' ? vazioId : erroId,
  };
  return (
    <>
      {campo.tipo === 'escolha' ? (
        <select
          {...marcarCampo(campo.id)}
          {...acessibilidade}
          // Valor que o tipo não oferece (ex.: veio de outro tipo) aparece como "Selecione…".
          value={campo.opcoes?.some((o) => o.valor === valor) ? valor : ''}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        >
          <option value="">Selecione…</option>
          {campo.opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          {...marcarCampo(campo.id)}
          {...acessibilidade}
          {...(campo.teclado ? { inputMode: campo.teclado } : {})}
          value={valor}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      )}
      {problema?.tipo === 'invalido' ? (
        <p id={erroId} className={styles.erroLinha}>
          <span aria-hidden="true">⚠ </span>
          {problema.mensagem}
        </p>
      ) : null}
    </>
  );
}

/** Uma linha da tabela. Memoizada: com centenas de linhas, editar uma não redesenha as outras. */
const Linha = memo(function Linha(props: LinhaProps) {
  const { participante: p, posicao, colunas, pessoa, dispatch } = props;
  const atualizar = (patch: Partial<Participante>) => {
    dispatch({ type: 'atualizarParticipante', id: p.id, patch });
  };
  const nomeVazio = p.nome.trim() === '';
  const quem = nomeVazio ? `${pessoa.singular} ${String(posicao)}` : p.nome;
  const daLinha = `do ${pessoa.singular} ${String(posicao)}`;
  const baseId = useId();
  const problemas = problemasDaLinha(props);

  const celula = (coluna: ColunaParticipante, indice: number) => {
    switch (coluna.id) {
      case 'nome':
        return (
          <td key={coluna.id} data-rotulo={coluna.rotulo}>
            <input
              type="text"
              {...marcarCampo('nome')}
              aria-label={`Nome ${daLinha}`}
              aria-invalid={nomeVazio}
              aria-describedby={nomeVazio ? `${baseId}-nome` : undefined}
              value={p.nome}
              onChange={(e) => {
                atualizar({ nome: e.target.value });
              }}
            />
            {nomeVazio ? (
              <p id={`${baseId}-nome`} className={styles.erroLinha}>
                <span aria-hidden="true">⚠ </span>
                Informe o nome.
              </p>
            ) : null}
          </td>
        );
      case 'papel':
        return (
          <td key={coluna.id} data-rotulo={coluna.rotulo}>
            <input
              type="text"
              aria-label={`${coluna.rotulo} ${daLinha}`}
              value={p.papel}
              onChange={(e) => {
                atualizar({ papel: e.target.value });
              }}
            />
          </td>
        );
      case 'presenca':
        return (
          <td key={coluna.id} data-rotulo={coluna.rotulo}>
            <select
              aria-label={`Presença de ${quem}`}
              value={p.presenca}
              onChange={(e) => {
                const presenca = PRESENCAS.find((x) => x === e.target.value);
                if (presenca) atualizar({ presenca });
              }}
            >
              {PRESENCAS.map((valor) => (
                <option key={valor} value={valor}>
                  {ROTULO_PRESENCA[valor]}
                </option>
              ))}
            </select>
            {p.presenca === 'justificado' ? (
              <input
                type="text"
                className={styles.justificativa}
                aria-label={`Justificativa de ${quem}`}
                placeholder="Justificativa"
                value={p.justificativa}
                onChange={(e) => {
                  atualizar({ justificativa: e.target.value });
                }}
              />
            ) : null}
          </td>
        );
      default:
        return coluna.campo ? (
          <td key={coluna.id} data-rotulo={coluna.rotulo}>
            <CampoExtra
              campo={coluna.campo}
              valor={p.extras[coluna.id] ?? ''}
              rotulo={`${coluna.rotulo} ${daLinha}`}
              problema={problemas[indice] ?? null}
              erroId={`${baseId}-${coluna.id}`}
              vazioId={idDoResumoVazios(props.vaziosId, coluna.id)}
              onChange={(valor) => {
                atualizar({ extras: { ...p.extras, [coluna.id]: valor } });
              }}
            />
          </td>
        ) : null;
    }
  };

  return (
    <tr data-id={p.id}>
      {colunas.map(celula)}
      <td data-rotulo="Ação" className={styles.celulaAcao}>
        <button
          type="button"
          className={styles.botaoRemover}
          aria-label={`Remover ${quem}`}
          title="Remover da lista"
          onClick={() => {
            dispatch({ type: 'removerParticipante', id: p.id });
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}, mesmaLinha);

interface PreencherVaziosProps {
  campo: CampoDef;
  rotulo: string;
  /** Quantos participantes estão sem valor neste campo. */
  vazios: number;
  /** Quantos têm um valor que as opções do campo não oferecem (ex.: veio de outro tipo). */
  invalidos: number;
  /** Campo obrigatório: a contagem dos vazios já está na linha de resumo da coluna. */
  obrigatorio: boolean;
  pessoa: RotuloPessoa;
  onAplicar: (valor: string) => void;
}

/** "Preencher os vazios — {campo}": aplica um valor só a quem ainda não tem (nunca sobrescreve). */
function PreencherVazios({
  campo,
  rotulo,
  vazios,
  invalidos,
  obrigatorio,
  pessoa,
  onAplicar,
}: PreencherVaziosProps) {
  const [valor, setValor] = useState('');
  const tituloId = useId();
  return (
    <div role="group" aria-labelledby={tituloId} className={styles.preencherVazios}>
      <span id={tituloId} className={styles.preencherTitulo}>
        {`Preencher os vazios — ${rotulo}`}
      </span>
      <select
        className={styles.preencherSelect}
        aria-label={`Valor para os vazios — ${rotulo}`}
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
        }}
      >
        <option value="">Selecione…</option>
        {campo.opcoes?.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <Button
        aria-label={`Aplicar — ${rotulo}`}
        disabled={vazios === 0 || valor === ''}
        onClick={() => {
          onAplicar(valor);
          setValor('');
        }}
      >
        Aplicar
      </Button>
      <span className={styles.preencherContagem}>
        {[
          vazios === 0 && invalidos === 0 ? 'Ninguém está sem valor.' : null,
          vazios > 0 && !obrigatorio
            ? `${String(vazios)} ${plural(vazios, pessoa.singular, pessoa.plural)} sem valor.`
            : null,
          invalidos > 0 ? `${String(invalidos)} com valor inválido — corrija na lista.` : null,
        ]
          .filter((t) => t !== null)
          .join(' ')}
      </span>
    </div>
  );
}

/** Texto em que a busca procura: nome, papel e extras (valor digitado e rótulo da opção). */
function textoDeBusca(p: Participante, colunas: ColunaParticipante[]): string {
  const extras = colunas.flatMap((c) => {
    if (!c.campo) return [];
    const valor = p.extras[c.id] ?? '';
    return [valor, rotuloDaOpcao(c.campo, valor) ?? ''];
  });
  return normalizarBusca([p.nome, p.papel, ...extras].join(' '));
}

export function ParticipantesBlock({ tipo }: { tipo: AtaTypeDefinition }) {
  const { state, dispatch } = useDraft();
  const { participantes, dados } = state;
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
  // `base` = lista de participantes logo após a ação; se a lista mudar por outro caminho
  // (editar, remover), o aviso sai de cena para nunca afirmar uma contagem velha.
  const [aviso, setAviso] = useState<{
    texto: string;
    base: Participante[] | null;
    /** Desfaz a ação do aviso enquanto a lista não mudou por outro caminho. */
    desfazer?: () => void;
  } | null>(null);
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const vaziosId = useId();
  const [novoNome, setNovoNome] = useState('');
  const [novoComplemento, setNovoComplemento] = useState('');
  const [erroNovo, setErroNovo] = useState<string | undefined>(undefined);
  const novoNomeRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const listaId = useId();
  const telaEstreita = useConsultaMidia(CONSULTA_TELA_ESTREITA, false);
  const pessoa = tipo.rotulos.pessoa;
  /** "1 sócio" / "3 sócios": a quantidade com o substantivo do tipo. */
  const quantas = (n: number): string =>
    `${String(n)} ${plural(n, pessoa.singular, pessoa.plural)}`;

  const colunas = useMemo(() => colunasDeParticipantes(tipo, dados), [tipo, dados]);
  // Para onde vai o "X" de "Nome — X": o extra declarado pelo tipo ou, sem ele, o papel.
  const campoComplemento = tipo.camposParticipante.find((c) => c.id === tipo.campoComplemento);
  const destino = campoComplemento?.id;
  const rotuloComplemento = campoComplemento
    ? rotuloDoCampo(campoComplemento, dados)
    : tipo.rotuloPapel;
  const complementoDe = (p: Participante): string =>
    destino === undefined ? p.papel : (p.extras[destino] ?? '');
  // O aviso de repetição só compara o complemento que distingue pessoas (unidade, cargo).
  const paraRepeticao = (l: LinhaParticipante): LinhaParticipante =>
    tipo.complementoIdentifica ? l : { nome: l.nome, complemento: '' };

  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'participantes')
    .map((f) => f.rotulo);

  const resumo = useMemo(
    () => tipo.resumoDosParticipantes?.({ dados, participantes }) ?? null,
    [tipo, dados, participantes],
  );

  // O resumo (texto e alertas) fica à vista sempre, fora da árvore de acessibilidade; o leitor de
  // tela o ouve uma vez só, pela região `status`: o texto VIGENTE, depois de a pessoa parar de
  // mexer (o texto de alguns tipos muda a cada tecla, ex.: somas). Os alertas vão junto: a soma
  // acima do total não tem texto de resumo e, sem eles, nada seria anunciado.
  const resumoFalado =
    resumo === null ? null : [resumo.texto, ...resumo.alertas].filter(Boolean).join(' ');
  const resumoAnunciado = useTextoAdiado(resumoFalado, ESPERA_ANUNCIO_RESUMO_MS);

  if (aviso) {
    if (aviso.base === null) setAviso({ ...aviso, base: participantes });
    else if (aviso.base !== participantes) setAviso(null);
  }

  const total = participantes.length;
  const presentes = participantes.filter((p) => p.presenca === 'presente').length;
  const comRolagem = total > PARTICIPANTES_ATE_ROLAGEM;
  const termo = comRolagem ? normalizarBusca(busca) : '';
  // No celular a lista longa vira centenas de cartões e empurra a transcrição e "Gerar ata" para
  // longe: ela começa recolhida (sem busca), com o resumo, a busca e os controles de adição à vista.
  const recolhivel = comRolagem && telaEstreita && termo === '';
  const recolhida = recolhivel && !listaAberta;
  const semNome = participantes.filter((p) => p.nome.trim() === '').length;

  // A linha em edição continua visível mesmo que o texto digitado deixe de casar com a busca; na
  // lista recolhida, as linhas sem nome também (precisam de correção e o "Falta" leva até elas).
  const visiveis = useMemo(() => {
    const todas = participantes.map((p, i) => ({ p, posicao: i + 1 }));
    if (recolhida) return todas.filter(({ p }) => p.id === emEdicao || p.nome.trim() === '');
    if (termo === '') return todas;
    return todas.filter(({ p }) => p.id === emEdicao || textoDeBusca(p, colunas).includes(termo));
  }, [participantes, termo, emEdicao, recolhida, colunas]);

  // Por coluna de extra: quantos estão sem valor (mesmo critério da validação: `textoLimpo`) e,
  // nos de escolha, quantos têm valor fora das opções.
  const contagens = useMemo(
    () =>
      colunas.flatMap((coluna) => {
        const campo = coluna.campo;
        if (!campo) return [];
        const valores = participantes.map((p) => textoLimpo(p.extras[coluna.id]));
        return [
          {
            coluna,
            campo,
            obrigatorio: ehObrigatorio(campo, dados),
            vazios: valores.filter((v) => v === '').length,
            invalidos:
              campo.tipo === 'escolha'
                ? valores.filter((v) => v !== '' && rotuloDaOpcao(campo, v) === null).length
                : 0,
          },
        ];
      }),
    [colunas, participantes, dados],
  );

  /** Adiciona as linhas, avisa o resultado e devolve quantas entraram. */
  const registrar = (linhas: LinhaParticipante[]): number => {
    // Tipo sem lugar para o complemento: ele fica no nome, nunca é descartado em silêncio.
    const efetivas =
      rotuloComplemento === null
        ? linhas.map(({ nome, complemento }) => ({
            nome: complemento === '' ? nome : `${nome} — ${complemento}`,
            complemento: '',
          }))
        : linhas;
    const { adicionados, ignorados } = calcularAdicao(total, efetivas.length);
    const repetidos = contarRepetidos(
      efetivas.slice(0, adicionados).map(paraRepeticao),
      participantes.map((p) => paraRepeticao({ nome: p.nome, complemento: complementoDe(p) })),
    );
    dispatch({
      type: 'adicionarParticipantes',
      nomes: efetivas.map((l) => l.nome),
      complementos: efetivas.map((l) => l.complemento),
      ...(destino === undefined ? {} : { destino }),
    });
    setAviso({
      texto: descreverAdicao({ adicionados, ignorados, repetidos }, pessoa),
      base: null,
    });
    return adicionados;
  };

  const adicionarLista = () => {
    const linhas = analisarLista(texto);
    if (linhas.length === 0) {
      setAviso({
        texto: 'Nenhum nome encontrado no texto colado. Escreva um nome por linha.',
        base: participantes,
      });
      return;
    }
    registrar(linhas);
    setTexto('');
    setColando(false);
  };

  const adicionarUm = (e: SubmitEvent) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (nome === '') {
      setErroNovo(`Informe o nome do ${pessoa.singular}.`);
      novoNomeRef.current?.focus();
      return;
    }
    if (registrar([{ nome, complemento: novoComplemento.trim() }]) > 0) {
      setNovoNome('');
      setNovoComplemento('');
    }
    setErroNovo(undefined);
    novoNomeRef.current?.focus();
  };

  const marcarTodosPresentes = () => {
    const alvo = participantes.filter((p) => p.presenca !== 'presente');
    for (const p of alvo) {
      dispatch({ type: 'atualizarParticipante', id: p.id, patch: { presenca: 'presente' } });
    }
    setAviso({
      texto: `${quantas(alvo.length)} ${plural(alvo.length, 'marcado como presente', 'marcados como presentes')}.`,
      base: null,
    });
  };

  const preencherVazios = (campo: CampoDef, rotulo: string, valor: string) => {
    const ids = participantes.filter((p) => textoLimpo(p.extras[campo.id]) === '').map((p) => p.id);
    dispatch({ type: 'preencherExtrasVazios', campo: campo.id, valor });
    setAviso({
      texto: descreverPreenchimento(
        rotulo,
        rotuloDaOpcao(campo, valor) ?? valor,
        ids.length,
        pessoa,
      ),
      base: null,
      desfazer: () => {
        dispatch({ type: 'limparExtra', campo: campo.id, ids });
        setAviso({
          texto: `Preenchimento desfeito: ${quantas(ids.length)} ${plural(ids.length, 'voltou', 'voltaram')} a ficar sem valor.`,
          base: null,
        });
        // O botão sai de cena: o foco fica no aviso, que passa a anunciar o resultado.
        avisoRef.current?.focus();
      },
    });
  };

  return (
    <FormBlock
      numero={3}
      titulo={tipo.rotulos.participantes}
      bloco="participantes"
      faltando={faltando}
    >
      <div className={styles.barra}>
        <p className={styles.contador} aria-live="polite">
          {`${quantas(total)} · ${String(presentes)} ${plural(presentes, 'presente', 'presentes')}`}
        </p>
        <div className={styles.acoesBarra}>
          <Button
            aria-expanded={colando}
            onClick={() => {
              setColando((v) => !v);
            }}
          >
            Colar lista
          </Button>
          <Button disabled={presentes === total} onClick={marcarTodosPresentes}>
            Marcar todos como presentes
          </Button>
        </div>
      </div>

      {resumo?.texto ? (
        <p aria-hidden="true" className={styles.resumoTexto}>
          {resumo.texto}
        </p>
      ) : null}
      {resumo !== null ? (
        <p role="status" className={styles.somenteLeitor}>
          {resumoAnunciado}
        </p>
      ) : null}
      {resumo?.alertas.map((alerta) => (
        <p key={alerta} aria-hidden="true" className={styles.alertaResumo}>
          ⚠ {alerta}
        </p>
      ))}

      <form className={styles.novoParticipante} onSubmit={adicionarUm} noValidate>
        <Field rotulo={`Nome do novo ${pessoa.singular}`} obrigatorio erro={erroNovo}>
          {(controle) => (
            <input
              {...controle}
              {...marcarCampo('participantes')}
              ref={novoNomeRef}
              type="text"
              value={novoNome}
              onChange={(e) => {
                setNovoNome(e.target.value);
                setErroNovo(undefined);
              }}
            />
          )}
        </Field>
        {rotuloComplemento === null ? null : (
          <Field
            rotulo={
              campoComplemento?.obrigatorio === true
                ? rotuloComplemento
                : `${rotuloComplemento} (opcional)`
            }
            ajuda={
              campoComplemento?.obrigatorio === true
                ? 'Se não tiver agora, preencha depois na lista.'
                : undefined
            }
          >
            {(controle) => (
              <input
                {...controle}
                type="text"
                {...(campoComplemento?.teclado ? { inputMode: campoComplemento.teclado } : {})}
                value={novoComplemento}
                onChange={(e) => {
                  setNovoComplemento(e.target.value);
                }}
              />
            )}
          </Field>
        )}
        <div className={styles.novoParticipanteBotao}>
          <Button type="submit" variante="primario">
            {`Adicionar ${pessoa.singular}`}
          </Button>
        </div>
      </form>

      {colando ? (
        <div className={styles.painelColar}>
          <Field
            rotulo="Nomes, um por linha"
            ajuda={rotuloComplemento === null ? undefined : `Aceita “Nome — ${rotuloComplemento}”.`}
          >
            {(controle) => (
              <textarea
                {...controle}
                rows={6}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                }}
              />
            )}
          </Field>
          <div className={styles.acoesBarra}>
            <Button variante="primario" onClick={adicionarLista}>
              Adicionar à lista
            </Button>
            <Button
              onClick={() => {
                setColando(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {aviso !== null && (aviso.base === null || aviso.base === participantes) ? (
        <div className={styles.aviso}>
          <p ref={avisoRef} role="status" tabIndex={-1} className={styles.avisoTexto}>
            {aviso.texto}
          </p>
          {aviso.desfazer ? <Button onClick={aviso.desfazer}>Desfazer</Button> : null}
        </div>
      ) : null}

      {total === 0 ? (
        <p className={styles.vazio}>
          {`Nenhum ${pessoa.singular} ainda. Digite um nome acima e tecle Enter, ou use “Colar lista” para adicionar vários de uma vez.`}
        </p>
      ) : (
        <>
          {contagens.some((c) => c.obrigatorio && c.vazios > 0) ? (
            <div className={styles.resumoVazios}>
              {contagens
                .filter((c) => c.obrigatorio && c.vazios > 0)
                .map(({ coluna, vazios }) => (
                  <p key={coluna.id} id={idDoResumoVazios(vaziosId, coluna.id)}>
                    <span aria-hidden="true">⚠ </span>
                    {`${coluna.rotulo}: ${quantas(vazios)} sem valor.`}
                  </p>
                ))}
            </div>
          ) : null}
          {contagens
            .filter((c) => c.campo.tipo === 'escolha')
            .map(({ coluna, campo, vazios, invalidos, obrigatorio }) => (
              <PreencherVazios
                key={coluna.id}
                campo={campo}
                rotulo={coluna.rotulo}
                vazios={vazios}
                invalidos={invalidos}
                obrigatorio={obrigatorio}
                pessoa={pessoa}
                onAplicar={(valor) => {
                  preencherVazios(campo, coluna.rotulo, valor);
                }}
              />
            ))}
          {comRolagem ? (
            <div className={styles.busca}>
              <Field rotulo={`Buscar ${pessoa.singular}`}>
                {(controle) => (
                  <input
                    {...controle}
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setEmEdicao(null);
                    }}
                  />
                )}
              </Field>
            </div>
          ) : null}
          {recolhivel ? (
            <div className={styles.alternarLista}>
              <Button
                aria-expanded={listaAberta}
                aria-controls={listaId}
                onClick={() => {
                  setListaAberta((v) => !v);
                  setEmEdicao(null);
                }}
              >
                {listaAberta ? 'Ocultar a lista' : `Mostrar os ${quantas(total)}`}
              </Button>
              {recolhida && semNome > 0 ? (
                <p>{`${quantas(semNome)} sem nome ${plural(semNome, 'continua', 'continuam')} à vista para correção.`}</p>
              ) : null}
            </div>
          ) : null}
          {/* Contêiner das consultas `@container` dos cartões (form.module.css). */}
          <div id={listaId} className={styles.listaConteiner}>
            {visiveis.length === 0 ? (
              termo === '' ? null : (
                <p className={styles.vazio}>
                  {`Nenhum ${pessoa.singular} encontrado para “${busca.trim()}”. `}
                  <Button
                    onClick={() => {
                      setBusca('');
                    }}
                  >
                    Limpar busca
                  </Button>
                </p>
              )
            ) : (
              <div
                className={styles.tabelaRolagem}
                role="region"
                aria-label={`Lista de ${pessoa.plural}`}
                tabIndex={0}
                data-rolagem={comRolagem}
                // Quantas colunas de dados: decide quando a lista vira cartões (form.module.css).
                data-colunas={colunas.length}
              >
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      {colunas.map((coluna) => (
                        <th key={coluna.id} scope="col">
                          {coluna.rotulo}
                        </th>
                      ))}
                      <th scope="col">
                        <span className={styles.somenteLeitor}>Ação</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    onFocus={(e) => {
                      const alvo = e.target instanceof Element ? e.target.closest('tr') : null;
                      setEmEdicao(alvo instanceof HTMLElement ? (alvo.dataset.id ?? null) : null);
                    }}
                  >
                    {visiveis.map(({ p, posicao }) => (
                      <Linha
                        key={p.id}
                        participante={p}
                        posicao={posicao}
                        colunas={colunas}
                        dados={dados}
                        vaziosId={vaziosId}
                        pessoa={pessoa}
                        dispatch={dispatch}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </FormBlock>
  );
}
