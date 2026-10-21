import { memo, useId, useMemo, useRef, useState, type Dispatch, type SubmitEvent } from 'react';
import { camposFaltando } from '../../ata-types/registry';
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
import { useConsultaMidia } from '../../ui/useConsultaMidia';
import { marcarCampo } from './focar-campo';
import { FormBlock } from './FormBlock';
import {
  analisarLista,
  contarRepetidos,
  descreverAdicao,
  normalizarBusca,
  type LinhaParticipante,
} from './lista-participantes';
import styles from './form.module.css';

const CONSULTA_CARTOES = `(max-width: ${String(LARGURA_CARTOES_REM)}rem)`;

function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}

interface LinhaProps {
  participante: Participante;
  posicao: number;
  tipo: AtaTypeDefinition;
  dispatch: Dispatch<DraftAction>;
}

function CampoExtra({
  campo,
  valor,
  rotulo,
  onChange,
}: {
  campo: CampoDef;
  valor: string;
  rotulo: string;
  onChange: (valor: string) => void;
}) {
  if (campo.tipo === 'escolha') {
    return (
      <select
        {...marcarCampo(campo.id)}
        aria-label={rotulo}
        value={valor}
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
    );
  }
  return (
    <input
      type="text"
      {...marcarCampo(campo.id)}
      aria-label={rotulo}
      value={valor}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
}

/** Uma linha da tabela. Memoizada: com centenas de linhas, editar uma não redesenha as outras. */
const Linha = memo(function Linha({ participante: p, posicao, tipo, dispatch }: LinhaProps) {
  const atualizar = (patch: Partial<Participante>) => {
    dispatch({ type: 'atualizarParticipante', id: p.id, patch });
  };
  const nomeVazio = p.nome.trim() === '';
  const quem = nomeVazio ? `participante ${String(posicao)}` : p.nome;
  const erroNomeId = useId();

  return (
    <tr data-id={p.id}>
      <td data-rotulo="Nome">
        <input
          type="text"
          {...marcarCampo('nome')}
          aria-label={`Nome do participante ${String(posicao)}`}
          aria-invalid={nomeVazio}
          aria-describedby={nomeVazio ? erroNomeId : undefined}
          value={p.nome}
          onChange={(e) => {
            atualizar({ nome: e.target.value });
          }}
        />
        {nomeVazio ? (
          <p id={erroNomeId} className={styles.erroLinha}>
            <span aria-hidden="true">⚠ </span>
            Informe o nome.
          </p>
        ) : null}
      </td>
      <td data-rotulo={tipo.rotuloPapel}>
        <input
          type="text"
          aria-label={`${tipo.rotuloPapel} do participante ${String(posicao)}`}
          value={p.papel}
          onChange={(e) => {
            atualizar({ papel: e.target.value });
          }}
        />
      </td>
      {tipo.camposParticipante.map((campo) => (
        <td key={campo.id} data-rotulo={campo.rotulo}>
          <CampoExtra
            campo={campo}
            valor={p.extras[campo.id] ?? ''}
            rotulo={`${campo.rotulo} do participante ${String(posicao)}`}
            onChange={(valor) => {
              atualizar({ extras: { ...p.extras, [campo.id]: valor } });
            }}
          />
        </td>
      ))}
      <td data-rotulo="Presença">
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
});

export function ParticipantesBlock({ tipo }: { tipo: AtaTypeDefinition }) {
  const { state, dispatch } = useDraft();
  const { participantes } = state;
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
  // `base` = lista de participantes logo após a ação; se a lista mudar por outro caminho
  // (editar, remover), o aviso sai de cena para nunca afirmar uma contagem velha.
  const [aviso, setAviso] = useState<{ texto: string; base: Participante[] | null } | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoPapel, setNovoPapel] = useState('');
  const [erroNovo, setErroNovo] = useState<string | undefined>(undefined);
  const novoNomeRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const listaId = useId();
  const telaDeCartoes = useConsultaMidia(CONSULTA_CARTOES, false);

  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'participantes')
    .map((f) => f.rotulo);

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
    return todas.filter(
      ({ p }) => p.id === emEdicao || normalizarBusca(`${p.nome} ${p.papel}`).includes(termo),
    );
  }, [participantes, termo, emEdicao, recolhida]);

  /** Adiciona as linhas, avisa o resultado e devolve quantas entraram. */
  const registrar = (linhas: LinhaParticipante[]): number => {
    const { adicionados, ignorados } = calcularAdicao(total, linhas.length);
    const repetidos = contarRepetidos(
      linhas.slice(0, adicionados).map((l) => l.nome),
      participantes.map((p) => p.nome),
    );
    dispatch({
      type: 'adicionarParticipantes',
      nomes: linhas.map((l) => l.nome),
      papeis: linhas.map((l) => l.papel),
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
    if (registrar([{ nome, papel: novoPapel.trim() }]) > 0) {
      setNovoNome('');
      setNovoPapel('');
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

  return (
    <FormBlock numero={3} titulo="Participantes" bloco="participantes" faltando={faltando}>
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
        <Field rotulo={`${tipo.rotuloPapel} (opcional)`}>
          {(controle) => (
            <input
              {...controle}
              type="text"
              value={novoPapel}
              onChange={(e) => {
                setNovoPapel(e.target.value);
              }}
            />
          )}
        </Field>
        <div className={styles.novoParticipanteBotao}>
          <Button type="submit" variante="primario">
            Adicionar participante
          </Button>
        </div>
      </form>

      {colando ? (
        <div className={styles.painelColar}>
          <Field rotulo="Nomes, um por linha" ajuda="Aceita “Nome — Cargo”.">
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
                      <th scope="col">Nome</th>
                      <th scope="col">{tipo.rotuloPapel}</th>
                      {tipo.camposParticipante.map((campo) => (
                        <th key={campo.id} scope="col">
                          {campo.rotulo}
                        </th>
                      ))}
                      <th scope="col">Presença</th>
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
                        tipo={tipo}
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
