import { memo, useMemo, useState, type Dispatch } from 'react';
import { camposFaltando } from '../../ata-types/registry';
import type { AtaTypeDefinition, CampoDef } from '../../ata-types/types';
import { LIMITE_PARTICIPANTES, PARTICIPANTES_ATE_ROLAGEM } from '../../config/limits';
import { useDraft } from '../../domain/DraftContext';
import { PRESENCAS, type DraftAction, type Participante, type Presenca } from '../../domain/draft';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { FormBlock } from './FormBlock';
import { analisarLista, normalizarBusca } from './lista-participantes';
import styles from './form.module.css';

const ROTULO_PRESENCA: Record<Presenca, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Ausência justificada',
};

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
  const quem = p.nome.trim() === '' ? `participante ${String(posicao)}` : p.nome;

  return (
    <tr data-id={p.id}>
      <td data-rotulo="Nome">
        <input
          type="text"
          aria-label={`Nome do participante ${String(posicao)}`}
          aria-invalid={p.nome.trim() === ''}
          value={p.nome}
          onChange={(e) => {
            atualizar({ nome: e.target.value });
          }}
        />
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<string | null>(null);

  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'participantes')
    .map((f) => f.rotulo);

  const total = participantes.length;
  const presentes = participantes.filter((p) => p.presenca === 'presente').length;
  const comRolagem = total > PARTICIPANTES_ATE_ROLAGEM;
  const termo = comRolagem ? normalizarBusca(busca) : '';

  // A linha em edição continua visível mesmo que o texto digitado deixe de casar com a busca.
  const visiveis = useMemo(() => {
    if (termo === '') return participantes.map((p, i) => ({ p, posicao: i + 1 }));
    return participantes
      .map((p, i) => ({ p, posicao: i + 1 }))
      .filter(
        ({ p }) => p.id === emEdicao || normalizarBusca(`${p.nome} ${p.papel}`).includes(termo),
      );
  }, [participantes, termo, emEdicao]);

  const adicionar = () => {
    const linhas = analisarLista(texto);
    if (linhas.length === 0) {
      setAviso('Nenhum nome encontrado no texto colado. Escreva um nome por linha.');
      return;
    }
    const vagas = Math.max(0, LIMITE_PARTICIPANTES - total);
    const adicionados = Math.min(linhas.length, vagas);
    const ignorados = linhas.length - adicionados;
    dispatch({
      type: 'adicionarParticipantes',
      nomes: linhas.map((l) => l.nome),
      papeis: linhas.map((l) => l.papel),
    });
    const partes = [
      adicionados === 0
        ? 'Nenhum nome foi adicionado.'
        : `${String(adicionados)} ${plural(adicionados, 'participante adicionado', 'participantes adicionados')}.`,
    ];
    if (ignorados > 0) {
      partes.push(
        `${String(ignorados)} ${plural(ignorados, 'nome ignorado', 'nomes ignorados')}: o limite é ${String(LIMITE_PARTICIPANTES)} participantes.`,
      );
    }
    setAviso(partes.join(' '));
    setTexto('');
    setColando(false);
  };

  const marcarTodosPresentes = () => {
    const alvo = participantes.filter((p) => p.presenca !== 'presente');
    for (const p of alvo) {
      dispatch({ type: 'atualizarParticipante', id: p.id, patch: { presenca: 'presente' } });
    }
    setAviso(
      `${String(alvo.length)} ${plural(alvo.length, 'participante marcado', 'participantes marcados')} como presente${alvo.length === 1 ? '' : 's'}.`,
    );
  };

  return (
    <FormBlock numero={3} titulo="Participantes" faltando={faltando}>
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

      {colando ? (
        <div className={styles.painelColar}>
          <Field
            rotulo="Nomes, um por linha"
            ajuda="Aceita “Nome — Cargo”. Para adicionar só uma pessoa, digite o nome."
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
            <Button variante="primario" onClick={adicionar}>
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

      {aviso ? (
        <p role="status" className={styles.aviso}>
          {aviso}
        </p>
      ) : null}

      {total === 0 ? (
        <p className={styles.vazio}>
          Nenhum participante ainda. Use “Colar lista” para adicionar quem participou da reunião.
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
          {visiveis.length === 0 ? (
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
        </>
      )}
    </FormBlock>
  );
}
