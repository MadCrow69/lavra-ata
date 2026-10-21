import { TIPO_PADRAO_ID } from '../ata-types/registry';
import { calcularAdicao } from './participantes';
import type { AtaDraft, Atribuicao, DraftAction, Participante, ResultadoAta } from './draft';

/** Chave de seção usada para `avisos`, `atribuicao` e `editadas` dos encaminhamentos. */
export const CHAVE_ENCAMINHAMENTOS = 'encaminhamentos';

/**
 * Chave de `resultado.avisos` para avisos da ata toda, exibidos acima das seções. Começa com `_`
 * para nunca coincidir com uma chave de seção (todas seguem `^[a-z][a-z0-9_]*$`, conferido em
 * teste para todos os tipos registrados).
 */
export const CHAVE_AVISOS_GERAIS = '_geral';

export function criarRascunho(tipoId: string = TIPO_PADRAO_ID): AtaDraft {
  return {
    versao: 1,
    tipoId,
    tom: 'formal',
    dados: {},
    pauta: [],
    participantes: [],
    transcricao: '',
    mapa: null,
    resultado: null,
  };
}

function novoParticipante(
  nome: string,
  complemento: string,
  destino: string | undefined,
): Participante {
  const noExtra = destino !== undefined && complemento !== '';
  return {
    id: crypto.randomUUID(),
    nome,
    papel: destino === undefined ? complemento : '',
    presenca: 'presente',
    justificativa: '',
    extras: noExtra ? { [destino]: complemento } : {},
  };
}

/** Aplica a troca de uma seção (ou dos encaminhamentos) já gravada em `resultado`. */
function registrarTroca(
  resultado: ResultadoAta,
  chave: string,
  avisos: string[],
  atribuicao: Atribuicao | null,
): Pick<ResultadoAta, 'atribuicao' | 'avisos' | 'editadas'> {
  const editadas = resultado.editadas.filter((c) => c !== chave);
  return {
    avisos: { ...resultado.avisos, [chave]: avisos },
    // Edição manual (atribuicao null) mantém a autoria anterior e marca a seção como editada.
    atribuicao: atribuicao
      ? { ...resultado.atribuicao, [chave]: atribuicao }
      : resultado.atribuicao,
    editadas: atribuicao ? editadas : [...editadas, chave],
  };
}

export function draftReducer(state: AtaDraft, action: DraftAction): AtaDraft {
  switch (action.type) {
    case 'definirTipo':
      // A ata gerada vale para o tipo anterior (as seções mudam); todo o resto é mantido.
      return { ...state, tipoId: action.tipoId, resultado: null };
    case 'definirTom':
      return { ...state, tom: action.tom };
    case 'definirCampo':
      return { ...state, dados: { ...state.dados, [action.campo]: action.valor } };
    case 'definirPauta':
      return { ...state, pauta: action.itens };
    case 'adicionarParticipantes': {
      const validos = action.nomes
        .map((nome, i) => ({
          nome: nome.trim(),
          complemento: (action.complementos?.[i] ?? '').trim(),
        }))
        .filter((p) => p.nome !== '');
      const { adicionados } = calcularAdicao(state.participantes.length, validos.length);
      const novos = validos
        .slice(0, adicionados)
        .map((p) => novoParticipante(p.nome, p.complemento, action.destino));
      return novos.length === 0
        ? state
        : { ...state, participantes: [...state.participantes, ...novos] };
    }
    case 'preencherExtrasVazios': {
      const vazio = (p: Participante) => (p.extras[action.campo] ?? '').trim() === '';
      if (!state.participantes.some(vazio)) return state;
      return {
        ...state,
        participantes: state.participantes.map((p) =>
          vazio(p) ? { ...p, extras: { ...p.extras, [action.campo]: action.valor } } : p,
        ),
      };
    }
    case 'atualizarParticipante':
      return {
        ...state,
        participantes: state.participantes.map((p) =>
          p.id === action.id ? { ...p, ...action.patch, id: p.id } : p,
        ),
      };
    case 'removerParticipante':
      return { ...state, participantes: state.participantes.filter((p) => p.id !== action.id) };
    case 'definirTranscricao':
      return { ...state, transcricao: action.texto };
    case 'registrarResultado':
      return { ...state, resultado: action.resultado, mapa: action.mapa };
    case 'substituirSecao': {
      if (!state.resultado) return state;
      const r = state.resultado;
      return {
        ...state,
        mapa: action.mapa ?? state.mapa,
        resultado: {
          ...r,
          ...registrarTroca(r, action.chave, action.avisos, action.atribuicao),
          secoes: { ...r.secoes, [action.chave]: action.blocos },
        },
      };
    }
    case 'substituirEncaminhamentos': {
      if (!state.resultado) return state;
      const r = state.resultado;
      return {
        ...state,
        mapa: action.mapa ?? state.mapa,
        resultado: {
          ...r,
          ...registrarTroca(r, CHAVE_ENCAMINHAMENTOS, action.avisos, action.atribuicao),
          encaminhamentos: action.itens,
        },
      };
    }
    case 'novaAta':
      return { ...criarRascunho(state.tipoId), tom: state.tom };
  }
}
