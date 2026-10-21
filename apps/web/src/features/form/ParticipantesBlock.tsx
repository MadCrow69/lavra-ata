import { memo, useId, useMemo, useRef, useState, type Dispatch, type SubmitEvent } from 'react';
import {
  camposFaltando,
  colunasDeParticipantes,
  mensagemObrigatorio,
  problemaDoCampo,
  rotuloDaOpcao,
  rotuloDoCampo,
  type ColunaParticipante,
} from '../../ata-types/registry';
import type { AtaTypeDefinition, CampoDef } from '../../ata-types/types';
import { PARTICIPANTES_ATE_ROLAGEM } from '../../config/limits';
import { LARGURA_CARTOES_REM } from '../../config/ui';
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
import styles from './form.module.css';

const CONSULTA_CARTOES = `(max-width: ${String(LARGURA_CARTOES_REM)}rem)`;

interface LinhaProps {
  participante: Participante;
  posicao: number;
  colunas: ColunaParticipante[];
  /** Os dados da reunião decidem a obrigatoriedade e a validade dos extras (ver `mesmaLinha`). */
  dados: Record<string, string>;
  dispatch: Dispatch<DraftAction>;
}

/** Mensagem do problema do valor de um extra, ou `null`. Mesmo critério da lista "falta". */
function erroDoExtra(
  campo: CampoDef,
  p: Participante,
  dados: Record<string, string>,
): string | null {
  const problema = problemaDoCampo(campo, p.extras[campo.id], dados);
  if (problema === null) return null;
  return problema.tipo === 'vazio' ? mensagemObrigatorio(campo, dados) : problema.mensagem;
}

function errosDaLinha({ participante, colunas, dados }: LinhaProps): (string | null)[] {
  return colunas.map((c) => (c.campo ? erroDoExtra(c.campo, participante, dados) : null));
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
 * ele só conta pelo que decide aqui (colunas visíveis e mensagens de erro dos extras); senão as
 * centenas de linhas redesenhariam a cada tecla digitada em "Dados da reunião".
 */
function mesmaLinha(a: LinhaProps, b: LinhaProps): boolean {
  if (
    a.participante !== b.participante ||
    a.posicao !== b.posicao ||
    a.dispatch !== b.dispatch ||
    !mesmasColunas(a.colunas, b.colunas)
  ) {
    return false;
  }
  if (a.dados === b.dados) return true;
  const antes = errosDaLinha(a);
  const depois = errosDaLinha(b);
  return antes.every((erro, i) => erro === depois[i]);
}

interface CampoExtraProps {
  campo: CampoDef;
  valor: string;
  rotulo: string;
  erro: string | null;
  erroId: string;
  onChange: (valor: string) => void;
}

function CampoExtra({ campo, valor, rotulo, erro, erroId, onChange }: CampoExtraProps) {
  const acessibilidade = {
    'aria-label': rotulo,
    'aria-invalid': erro !== null,
    'aria-describedby': erro === null ? undefined : erroId,
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
      {erro === null ? null : (
        <p id={erroId} className={styles.erroLinha}>
          <span aria-hidden="true">⚠ </span>
          {erro}
        </p>
      )}
    </>
  );
}

/** Uma linha da tabela. Memoizada: com centenas de linhas, editar uma não redesenha as outras. */
const Linha = memo(function Linha(props: LinhaProps) {
  const { participante: p, posicao, colunas, dispatch } = props;
  const atualizar = (patch: Partial<Participante>) => {
    dispatch({ type: 'atualizarParticipante', id: p.id, patch });
  };
  const nomeVazio = p.nome.trim() === '';
  const quem = nomeVazio ? `participante ${String(posicao)}` : p.nome;
  const baseId = useId();
  const erros = errosDaLinha(props);

  const celula = (coluna: ColunaParticipante, indice: number) => {
    switch (coluna.id) {
      case 'nome':
        return (
          <td key={coluna.id} data-rotulo={coluna.rotulo}>
            <input
              type="text"
              {...marcarCampo('nome')}
              aria-label={`Nome do participante ${String(posicao)}`}
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
              aria-label={`${coluna.rotulo} do participante ${String(posicao)}`}
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
              rotulo={`${coluna.rotulo} do participante ${String(posicao)}`}
              erro={erros[indice] ?? null}
              erroId={`${baseId}-${coluna.id}`}
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
  onAplicar: (valor: string) => void;
}

/** "Preencher os vazios — {campo}": aplica um valor só a quem ainda não tem (nunca sobrescreve). */
function PreencherVazios({ campo, rotulo, vazios, onAplicar }: PreencherVaziosProps) {
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
        disabled={vazios === 0 || valor === ''}
        onClick={() => {
          onAplicar(valor);
          setValor('');
        }}
      >
        Aplicar
      </Button>
      <span className={styles.preencherContagem}>
        {vazios === 0
          ? 'Ninguém está sem valor.'
          : `${String(vazios)} ${plural(vazios, 'participante sem valor', 'participantes sem valor')}.`}
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
  const [aviso, setAviso] = useState<{ texto: string; base: Participante[] | null } | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoComplemento, setNovoComplemento] = useState('');
  const [erroNovo, setErroNovo] = useState<string | undefined>(undefined);
  const novoNomeRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const listaId = useId();
  const telaDeCartoes = useConsultaMidia(CONSULTA_CARTOES, false);

  const colunas = useMemo(() => colunasDeParticipantes(tipo, dados), [tipo, dados]);
  // Para onde vai o "X" de "Nome — X": o extra declarado pelo tipo ou, sem ele, o papel.
  const campoComplemento = tipo.camposParticipante.find((c) => c.id === tipo.campoComplemento);
  const destino = campoComplemento?.id;
  const rotuloComplemento = campoComplemento
    ? rotuloDoCampo(campoComplemento, dados)
    : tipo.rotuloPapel;
  const complementoDe = (p: Participante): string =>
    destino === undefined ? p.papel : (p.extras[destino] ?? '');

  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'participantes')
    .map((f) => f.rotulo);

  const resumo = useMemo(
    () => tipo.resumoDosParticipantes?.({ dados, participantes }) ?? null,
    [tipo, dados, participantes],
  );

  if (aviso) {
    if (aviso.base === null) setAviso({ texto: aviso.texto, base: participantes });
    else if (aviso.base !== participantes) setAviso(null);
  }

  const total = participantes.length;
  const presentes = participantes.filter((p) => p.presenca === 'presente').length;
  const comRolagem = total > PARTICIPANTES_ATE_ROLAGEM;
  const termo = comRolagem ? normalizarBusca(busca) : '';
  // No celular a lista longa vira centenas de cartões e empurra a transcrição e "Gerar ata" para
  // longe: ela começa recolhida (sem busca), com o resumo, a busca e os controles de adição à vista.
  const recolhivel = comRolagem && telaDeCartoes && termo === '';
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

  // Campos de escolha sem valor em alguém: o controle "Preencher os vazios" de cada um.
  const preenchiveis = useMemo(
    () =>
      colunas.flatMap((c) =>
        c.campo?.tipo === 'escolha'
          ? [
              {
                coluna: c,
                campo: c.campo,
                vazios: participantes.filter((p) => (p.extras[c.id] ?? '').trim() === '').length,
              },
            ]
          : [],
      ),
    [colunas, participantes],
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
      efetivas.slice(0, adicionados),
      participantes.map((p) => ({ nome: p.nome, complemento: complementoDe(p) })),
    );
    dispatch({
      type: 'adicionarParticipantes',
      nomes: efetivas.map((l) => l.nome),
      complementos: efetivas.map((l) => l.complemento),
      ...(destino === undefined ? {} : { destino }),
    });
    setAviso({ texto: descreverAdicao({ adicionados, ignorados, repetidos }), base: null });
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
      setErroNovo('Informe o nome do participante.');
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
      texto: `${String(alvo.length)} ${plural(alvo.length, 'participante marcado', 'participantes marcados')} como presente${alvo.length === 1 ? '' : 's'}.`,
      base: null,
    });
  };

  const preencherVazios = (campo: CampoDef, rotulo: string, valor: string, vazios: number) => {
    dispatch({ type: 'preencherExtrasVazios', campo: campo.id, valor });
    setAviso({
      texto: descreverPreenchimento(rotulo, rotuloDaOpcao(campo, valor) ?? valor, vazios),
      base: null,
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
          {`${String(total)} ${plural(total, 'participante', 'participantes')} · ${String(presentes)} ${plural(presentes, 'presente', 'presentes')}`}
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
        <p role="status" className={styles.resumoTexto}>
          {resumo.texto}
        </p>
      ) : null}
      {resumo?.alertas.map((alerta) => (
        <p key={alerta} role="note" className={styles.alertaResumo}>
          <span aria-hidden="true">⚠ </span>
          {alerta}
        </p>
      ))}

      <form className={styles.novoParticipante} onSubmit={adicionarUm} noValidate>
        <Field rotulo="Nome do novo participante" obrigatorio erro={erroNovo}>
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
            Adicionar participante
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
        <p role="status" className={styles.aviso}>
          {aviso.texto}
        </p>
      ) : null}

      {total === 0 ? (
        <p className={styles.vazio}>
          Nenhum participante ainda. Digite um nome acima e tecle Enter, ou use “Colar lista” para
          adicionar vários de uma vez.
        </p>
      ) : (
        <>
          {preenchiveis.map(({ coluna, campo, vazios }) => (
            <PreencherVazios
              key={coluna.id}
              campo={campo}
              rotulo={coluna.rotulo}
              vazios={vazios}
              onAplicar={(valor) => {
                preencherVazios(campo, coluna.rotulo, valor, vazios);
              }}
            />
          ))}
          {comRolagem ? (
            <div className={styles.busca}>
              <Field rotulo="Buscar participante">
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
                {listaAberta ? 'Ocultar a lista' : `Mostrar os ${String(total)} participantes`}
              </Button>
              {recolhida && semNome > 0 ? (
                <p>{`${String(semNome)} ${plural(semNome, 'participante sem nome continua', 'participantes sem nome continuam')} à vista para correção.`}</p>
              ) : null}
            </div>
          ) : null}
          <div id={listaId}>
            {visiveis.length === 0 ? (
              termo === '' ? null : (
                <p className={styles.vazio}>
                  {`Nenhum participante encontrado para “${busca.trim()}”. `}
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
                aria-label="Lista de participantes"
                tabIndex={0}
                data-rolagem={comRolagem}
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
